<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=false displayMessage=true; section>
    <#if section = "form">
        <form id="kc-form-login" class="customer-form" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
            <!-- Username / Email Input -->
            <div class="form-group">
                <label for="username" class="form-label">
                    <span class="material-symbols-outlined label-icon">mail</span>
                    <span>Email Address or Username</span>
                </label>
                <div class="input-container">
                    <input 
                        tabindex="1" 
                        id="username" 
                        class="form-input" 
                        name="username" 
                        value="${(login.username!'')}" 
                        type="text" 
                        autofocus 
                        autocomplete="username"
                        placeholder="e.g. customer@example.com" 
                        required 
                    />
                </div>
            </div>

            <!-- Password Input -->
            <div class="form-group">
                <div class="label-with-link">
                    <label for="password" class="form-label">
                        <span class="material-symbols-outlined label-icon">lock</span>
                        <span>Password</span>
                    </label>
                    <#if realm.resetPasswordAllowed>
                        <a tabindex="5" class="helper-link forgot-password-link" href="${url.loginResetCredentialsUrl}">
                            Forgot Password?
                        </a>
                    </#if>
                </div>
                <div class="input-container">
                    <input 
                        tabindex="2" 
                        id="password" 
                        class="form-input" 
                        name="password" 
                        type="password" 
                        autocomplete="current-password"
                        placeholder="Enter your account password" 
                        required 
                    />
                </div>
            </div>

            <!-- Remember Me Checkbox (if enabled) -->
            <#if realm.rememberMe && !usernameHidden??>
                <div class="form-options">
                    <label class="checkbox-container">
                        <#if login.rememberMe??>
                            <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox" checked>
                        <#else>
                            <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox">
                        </#if>
                        <span class="checkmark"></span>
                        <span class="checkbox-label">Keep me signed in</span>
                    </label>
                </div>
            </#if>

            <!-- Login Action Button -->
            <div class="form-actions">
                <button tabindex="4" class="btn-submit btn-primary" name="login" id="kc-login" type="submit">
                    <span>Sign In</span>
                    <span class="material-symbols-outlined btn-icon">arrow_forward</span>
                </button>
            </div>

            <!-- Registration Link -->
            <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
                <div class="auth-switch-box">
                    <span class="switch-text">New to Indian Store?</span>
                    <a tabindex="6" class="switch-action-link" href="${url.registrationUrl}">
                        Create an Account
                    </a>
                </div>
            </#if>
        </form>
    </#if>
</@layout.registrationLayout>
