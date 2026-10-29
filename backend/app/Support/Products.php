<?php

namespace App\Support;

/**
 * What a company sells. The 30 L jar is always on; the 20 L bottle and refundable deposits
 * are switched on per company by the super admin. Rows without a product are jars.
 */
class Products
{
    public const JAR = 'jar';
    public const BOTTLE = 'bottle';
    public const ALL = [self::JAR, self::BOTTLE];

    /** Stock number prefix: JAR-001, BTL-001. */
    public const PREFIX = [self::JAR => 'JAR', self::BOTTLE => 'BTL'];

    /** Settings key holding each product's default rate and deposit. */
    public const RATE_KEY = [self::JAR => 'default_rate', self::BOTTLE => 'bottle_rate'];
    public const DEPOSIT_KEY = [self::JAR => 'jar_deposit', self::BOTTLE => 'bottle_deposit'];

    /** @return list<string> */
    public static function enabled(): array
    {
        return CurrentCompany::get()?->bottles_enabled ? self::ALL : [self::JAR];
    }

    public static function depositEnabled(): bool
    {
        return (bool) CurrentCompany::get()?->deposit_enabled;
    }

    /** Pick the jar or the bottle wording of a (translated) message. */
    public static function msg(string $product, string $jar, string $bottle, array $replace = []): string
    {
        return __($product === self::BOTTLE ? $bottle : $jar, $replace);
    }
}
