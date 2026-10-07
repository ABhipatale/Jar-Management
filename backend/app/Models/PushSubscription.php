<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class PushSubscription extends Model
{
    use BelongsToCompany;

    protected $fillable = ['user_id', 'endpoint', 'p256dh', 'auth', 'locale'];
}
