<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=false displayMessage=true; section>
    <#if section = "form">
        <form id="kc-form-login" class="login-form" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
            <!-- Username Input -->
            <div class="form-group">
                <label for="username" class="form-label">
                    <span class="material-symbols-outlined label-icon">person</span>
                    <span>Username or Email</span>
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
                        placeholder="Enter username (e.g. manager, admin, ops)" 
                        required 
                    />
                </div>
            </div>

            <!-- Password Input -->
            <div class="form-group">
                <label for="password" class="form-label">
                    <span class="material-symbols-outlined label-icon">key</span>
                    <span>Password</span>
                </label>
                <div class="input-container">
                    <input 
                        tabindex="2" 
                        id="password" 
                        class="form-input" 
                        name="password" 
                        type="password" 
                        autocomplete="current-password"
                        placeholder="Enter password" 
                        required 
                    />
                </div>
            </div>

            <!-- Login Action Button -->
            <div class="form-actions">
                <button tabindex="3" class="btn-submit" name="login" id="kc-login" type="submit">
                    <span>Sign In</span>
                    <span class="material-symbols-outlined btn-arrow">arrow_forward</span>
                </button>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
