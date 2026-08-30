<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=false displayMessage=true; section>
    <#if section = "form">
        <form id="kc-reset-password-form" class="customer-form" action="${url.loginResetCredentialsUrl}" method="post">
            <div class="form-info-banner">
                <span class="material-symbols-outlined info-icon">info</span>
                <p class="info-text">
                    Enter your registered email address or username and we will send you secure password reset instructions.
                </p>
            </div>

            <!-- Username / Email Input -->
            <div class="form-group">
                <label for="username" class="form-label">
                    <span class="material-symbols-outlined label-icon">mail</span>
                    <span>Email Address or Username</span>
                </label>
                <div class="input-container">
                    <input 
                        tabindex="1" 
                        type="text" 
                        id="username" 
                        class="form-input" 
                        name="username" 
                        value="${(auth.selectedCredential!'')}" 
                        autocomplete="username" 
                        placeholder="e.g. customer@example.com" 
                        required 
                        autofocus 
                    />
                </div>
            </div>

            <!-- Submit Reset Button -->
            <div class="form-actions">
                <button tabindex="2" class="btn-submit btn-primary" type="submit">
                    <span>Send Reset Instructions</span>
                    <span class="material-symbols-outlined btn-icon">send</span>
                </button>
            </div>

            <!-- Back to Login -->
            <div class="auth-switch-box">
                <span class="switch-text">Remembered your password?</span>
                <a tabindex="3" class="switch-action-link" href="${url.loginUrl}">
                    ← Back to Sign In
                </a>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
