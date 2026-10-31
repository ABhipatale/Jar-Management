<?php

namespace App\Services;

/**
 * Short signed tokens for the public "view your bill" link sent on WhatsApp:
 *   base64url(company, customer, from, to, lang, design, expiry) . "." . HMAC
 * Nothing is stored; the signature (app key) makes the link impossible to guess or change.
 */
class BillLinkService
{
    public const DAYS = 90;

    public function make(int $companyId, int $customerId, string $from, string $to, string $lang, string $design): string
    {
        $payload = $this->b64(json_encode([$companyId, $customerId, $from, $to, $lang, $design, now()->addDays(self::DAYS)->timestamp]));

        return $payload.'.'.$this->sign($payload);
    }

    /** @return array{company:int, customer:int, from:string, to:string, lang:string, design:string}|null */
    public function parse(string $token): ?array
    {
        [$payload, $sig] = array_pad(explode('.', $token, 2), 2, '');
        if ($payload === '' || ! hash_equals($this->sign($payload), $sig)) {
            return null;
        }
        $d = json_decode((string) base64_decode(strtr($payload, '-_', '+/'), true), true);
        if (! is_array($d) || count($d) !== 7 || $d[6] < now()->timestamp) {
            return null;
        }

        return ['company' => (int) $d[0], 'customer' => (int) $d[1], 'from' => $d[2], 'to' => $d[3], 'lang' => $d[4], 'design' => $d[5]];
    }

    private function sign(string $payload): string
    {
        return substr($this->b64(hash_hmac('sha256', 'bill|'.$payload, (string) config('app.key'), true)), 0, 22);
    }

    private function b64(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }
}
