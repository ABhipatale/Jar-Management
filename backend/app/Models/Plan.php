<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/** A paid plan companies can buy (managed by the super admin). Not company-scoped. */
class Plan extends Model
{
    use SoftDeletes;

    protected $fillable = ['name', 'name_mr', 'price', 'interval', 'description', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return ['price' => 'float', 'is_active' => 'boolean', 'sort_order' => 'integer'];
    }
}
