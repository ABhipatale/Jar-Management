<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $fillable = ['expense_date', 'expense_type', 'amount', 'payment_mode', 'notes', 'client_uuid'];

    protected function casts(): array
    {
        return [
            'expense_date' => 'date:Y-m-d',
            'amount' => 'float',
        ];
    }
}
