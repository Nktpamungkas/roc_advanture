<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Support\Access\RoleNames;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_screen_can_be_rendered_when_bootstrap_is_open()
    {
        $response = $this->get('/register');

        $response->assertStatus(200);
    }

    public function test_new_users_can_register_and_become_super_admin()
    {
        $response = $this->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));

        $user = User::query()->where('email', 'test@example.com')->firstOrFail();

        $this->assertTrue((bool) $user->is_active);
        $this->assertTrue($user->hasRole(RoleNames::SUPER_ADMIN));
    }

    public function test_registration_screen_returns_not_found_after_first_user_exists()
    {
        User::factory()->create();

        $this->get('/register')->assertNotFound();
    }

    public function test_registration_submission_returns_not_found_after_first_user_exists()
    {
        User::factory()->create();

        $this->post('/register', [
            'name' => 'Second User',
            'email' => 'second@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertNotFound();
    }
}
