<?php

namespace App\Services;

use App\Models\AppSetting;

class AppSettingService
{
    public function getString(string $key, ?string $default = null): ?string
    {
        return AppSetting::query()
            ->where('key', $key)
            ->value('value') ?? $default;
    }

    public function getInt(string $key, int $default): int
    {
        $value = $this->getString($key);

        if ($value === null || ! is_numeric($value)) {
            return $default;
        }

        return (int) $value;
    }

    public function getBool(string $key, bool $default): bool
    {
        $value = $this->getString($key);

        if ($value === null) {
            return $default;
        }

        return filter_var($value, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? $default;
    }

    public function put(string $key, string|int|float|bool|null $value): void
    {
        AppSetting::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value === null ? null : (string) $value],
        );
    }
}
