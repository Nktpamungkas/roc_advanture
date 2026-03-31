<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rentals', function (Blueprint $table): void {
            $table->string('guarantee_note')->nullable()->after('notes');
        });

        Schema::table('returns', function (Blueprint $table): void {
            $table->boolean('guarantee_returned')->default(false)->after('settlement_amount');
        });
    }

    public function down(): void
    {
        Schema::table('returns', function (Blueprint $table): void {
            $table->dropColumn('guarantee_returned');
        });

        Schema::table('rentals', function (Blueprint $table): void {
            $table->dropColumn('guarantee_note');
        });
    }
};
