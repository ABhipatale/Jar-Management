<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One customer on one day's morning / evening route. */
class RouteStop extends Model
{
    use BelongsToCompany;

    public const SESSIONS = ['morning', 'evening'];

    public const PENDING = 'pending';

    public const DONE = 'done';

    public const SKIPPED = 'skipped';

    protected $attributes = ['status' => self::PENDING, 'quantity' => 1, 'added_manually' => false];

    protected $fillable = [
        'route_date', 'session', 'customer_id', 'position', 'quantity', 'status', 'skip_reason',
        'jar_transaction_id', 'added_manually', 'done_at',
    ];

    protected function casts(): array
    {
        return [
            'route_date' => 'date:Y-m-d',
            'position' => 'integer',
            'quantity' => 'integer',
            'added_manually' => 'boolean',
            'done_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** A jar entry was saved from this stop (same DB transaction as the entry). */
    public static function markDone(int $stopId, JarTransaction $tx): void
    {
        self::whereKey($stopId)->where('customer_id', $tx->customer_id)->where('status', '!=', self::DONE)
            ->update(['status' => self::DONE, 'skip_reason' => null, 'jar_transaction_id' => $tx->id, 'done_at' => now(), 'updated_at' => now()]);
    }

    /** The entry behind a delivered stop was deleted: the stop is to be delivered again. */
    public static function reopenFor(JarTransaction $tx): void
    {
        self::where('jar_transaction_id', $tx->id)
            ->update(['status' => self::PENDING, 'jar_transaction_id' => null, 'done_at' => null, 'updated_at' => now()]);
    }
}
