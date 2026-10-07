<?php

namespace App\Services;

use App\Support\CurrentCompany;
use App\Models\Jar;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Jar stock. Every physical jar is a row (JAR-001, JAR-002 …) but the shop can
 * work purely by quantity: add N jars, mark N damaged/lost, etc.
 *
 *   Available = Total - Jars with customers - Damaged - Lost
 *
 * "Jars with customers" always comes from jar_transactions, never from jar rows.
 */
class JarService
{
    /** Marathi labels for jar statuses (translation keys), used only in user-facing messages. */
    private const STATUS_MR = ['available' => 'उपलब्ध', 'damaged' => 'खराब', 'lost' => 'हरवलेले', 'returned' => 'परत'];

    /** Status label in the request's language (Marathi key, English via lang/en.json). */
    private function statusLabel(string $status): string
    {
        return __(self::STATUS_MR[$status] ?? $status);
    }

    public function __construct(private BalanceService $balances) {}

    public function summary(): array
    {
        $counts = Jar::query()
            ->selectRaw('status, COUNT(*) AS n')
            ->groupBy('status')
            ->pluck('n', 'status');

        $total = (int) $counts->sum();
        $damaged = (int) ($counts['damaged'] ?? 0);
        $lost = (int) ($counts['lost'] ?? 0);
        $customer = $this->balances->totalCustomerJars();

        return [
            'total_jars' => $total,
            'customer_jars' => $customer,
            'damaged_jars' => $damaged,
            'lost_jars' => $lost,
            'available_jars' => $total - $customer - $damaged - $lost,
        ];
    }

    public function addJars(int $qty): void
    {
        DB::transaction(function () use ($qty) {
            $next = $this->nextNumber();
            $now = now();
            $companyId = CurrentCompany::require();
            $rows = [];
            for ($i = 0; $i < $qty; $i++) {
                // Bulk insert skips model events, so company_id is set here.
                $rows[] = [
                    'company_id' => $companyId,
                    'jar_number' => sprintf('JAR-%03d', $next + $i),
                    'status' => 'available',
                    'status_date' => $now->toDateString(),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            foreach (array_chunk($rows, 500) as $chunk) {
                Jar::insert($chunk);
            }
        });
    }

    /** Remove unused jars (highest numbers first) when the shop lowers its total. */
    public function removeJars(int $qty): void
    {
        DB::transaction(function () use ($qty) {
            $s = $this->summary();
            if ($qty > $s['available_jars']) {
                throw ValidationException::withMessages([
                    'total_jars' => __('दुकानात फक्त :available जार उपलब्ध आहेत, :qty जार कमी करता येणार नाहीत.', ['available' => $s['available_jars'], 'qty' => $qty]),
                ]);
            }
            $ids = Jar::whereIn('status', ['available', 'returned'])
                ->orderByDesc('id')->limit($qty)->pluck('id');
            Jar::whereIn('id', $ids)->delete();
        });
    }

    public function setTotal(int $total): void
    {
        $current = Jar::count();
        if ($total > $current) {
            $this->addJars($total - $current);
        } elseif ($total < $current) {
            $this->removeJars($current - $total);
        }
    }

    /**
     * Quantity adjustments: damaged | lost (from the shop's available jars),
     * repaired (damaged → available), found (lost → available).
     */
    public function adjust(string $action, int $qty, string $date): void
    {
        DB::transaction(function () use ($action, $qty, $date) {
            [$from, $to] = match ($action) {
                'damaged' => [['available', 'returned'], 'damaged'],
                'lost' => [['available', 'returned'], 'lost'],
                'repaired' => [['damaged'], 'available'],
                'found' => [['lost'], 'available'],
            };

            if (in_array($to, ['damaged', 'lost'], true)) {
                $available = $this->summary()['available_jars'];
                if ($qty > $available) {
                    throw ValidationException::withMessages([
                        'quantity' => __('दुकानात फक्त :available जार उपलब्ध आहेत.', ['available' => $available]),
                    ]);
                }
            }

            $ids = Jar::whereIn('status', $from)->orderByDesc('id')->limit($qty)->lockForUpdate()->pluck('id');
            if ($ids->count() < $qty) {
                throw ValidationException::withMessages([
                    'quantity' => __('फक्त :count जार :status म्हणून नोंदवता येतील.', ['count' => $ids->count(), 'status' => $this->statusLabel($to)]),
                ]);
            }

            Jar::whereIn('id', $ids)->update(['status' => $to, 'customer_id' => null, 'status_date' => $date, 'updated_at' => now()]);
        });
    }

    /** Individual tracking: change one jar's status. */
    public function setStatus(Jar $jar, string $status, ?int $customerId): Jar
    {
        if (in_array($status, ['damaged', 'lost'], true) && ! in_array($jar->status, ['damaged', 'lost'], true)
            && $this->summary()['available_jars'] < 1) {
            throw ValidationException::withMessages(['status' => __(':status म्हणून नोंदवण्यासाठी एकही जार उपलब्ध नाही.', ['status' => $this->statusLabel($status)])]);
        }

        $jar->update([
            'status' => $status,
            'customer_id' => $status === 'with_customer' ? $customerId : null,
            'status_date' => now()->toDateString(),
        ]);

        return $jar;
    }

    private function nextNumber(): int
    {
        $max = 0;
        foreach (Jar::pluck('jar_number') as $n) {
            $max = max($max, (int) preg_replace('/\D/', '', $n));
        }

        return $max + 1;
    }
}
