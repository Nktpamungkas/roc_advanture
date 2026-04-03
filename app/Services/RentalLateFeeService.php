<?php

namespace App\Services;

use App\Http\Controllers\Admin\NotificationSettingController;
use Carbon\CarbonInterface;

class RentalLateFeeService
{
    public const DEFAULT_LATE_FEE_PER_DAY = 10000;

    public function __construct(
        private readonly AppSettingService $appSettingService,
    ) {
    }

    /**
     * @return array{enabled: bool, per_day: int, default_per_day: int}
     */
    public function settingsPayload(): array
    {
        return [
            'enabled' => $this->isEnabled(),
            'per_day' => $this->ratePerDay(),
            'default_per_day' => self::DEFAULT_LATE_FEE_PER_DAY,
        ];
    }

    /**
     * @return array{
     *     enabled: bool,
     *     is_late: bool,
     *     late_days: int,
     *     rate_per_day: int,
     *     default_amount: float
     * }
     */
    public function calculateContext(?CarbonInterface $dueAt, CarbonInterface $returnedAt): array
    {
        $lateDays = $this->calculateLateDays($dueAt, $returnedAt);
        $enabled = $this->isEnabled();
        $ratePerDay = $this->ratePerDay();

        return [
            'enabled' => $enabled,
            'is_late' => $lateDays > 0,
            'late_days' => $lateDays,
            'rate_per_day' => $ratePerDay,
            'default_amount' => $enabled && $lateDays > 0
                ? round($lateDays * $ratePerDay, 2)
                : 0.0,
        ];
    }

    public function isEnabled(): bool
    {
        return $this->appSettingService->getBool(NotificationSettingController::LATE_FEE_ENABLED_KEY, false);
    }

    public function ratePerDay(): int
    {
        return max(
            0,
            $this->appSettingService->getInt(
                NotificationSettingController::LATE_FEE_PER_DAY_KEY,
                self::DEFAULT_LATE_FEE_PER_DAY,
            ),
        );
    }

    public function calculateLateDays(?CarbonInterface $dueAt, CarbonInterface $returnedAt): int
    {
        if ($dueAt === null || ! $returnedAt->gt($dueAt)) {
            return 0;
        }

        return max(1, (int) ceil($dueAt->diffInMinutes($returnedAt) / 1440));
    }
}
