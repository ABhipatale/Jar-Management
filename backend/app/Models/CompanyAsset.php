<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A company's logo or generated app icon (base64 PNG). Looked up by company_id explicitly. */
class CompanyAsset extends Model
{
    protected $fillable = ['company_id', 'kind', 'mime', 'data'];

    protected $hidden = ['data'];
}
