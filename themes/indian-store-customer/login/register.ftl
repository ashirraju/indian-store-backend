<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=false displayMessage=true; section>
    <#if section = "form">
        <form id="kc-register-form" class="customer-form" action="${url.registrationAction}" method="post">
            <!-- Name Row (First Name & Last Name) -->
            <div class="form-row-2col">
                <div class="form-group">
                    <label for="firstName" class="form-label">
                        <span class="material-symbols-outlined label-icon">badge</span>
                        <span>First Name</span>
                    </label>
                    <div class="input-container">
                        <input 
                            tabindex="1" 
                            type="text" 
                            id="firstName" 
                            class="form-input" 
                            name="firstName" 
                            value="${(register.formData.firstName!'')}" 
                            placeholder="e.g. Aarav" 
                            required 
                            autofocus 
                        />
                    </div>
                </div>

                <div class="form-group">
                    <label for="lastName" class="form-label">
                        <span>Last Name</span>
                    </label>
                    <div class="input-container">
                        <input 
                            tabindex="2" 
                            type="text" 
                            id="lastName" 
                            class="form-input" 
                            name="lastName" 
                            value="${(register.formData.lastName!'')}" 
                            placeholder="e.g. Sharma" 
                            required 
                        />
                    </div>
                </div>
            </div>

            <!-- Email Input -->
            <div class="form-group">
                <label for="email" class="form-label">
                    <span class="material-symbols-outlined label-icon">mail</span>
                    <span>Email Address</span>
                </label>
                <div class="input-container">
                    <input 
                        tabindex="3" 
                        type="email" 
                        id="email" 
                        class="form-input" 
                        name="email" 
                        value="${(register.formData.email!'')}" 
                        autocomplete="email" 
                        placeholder="e.g. aarav.sharma@example.com" 
                        required 
                    />
                </div>
            </div>

            <!-- Username Input (if not registered strictly by email) -->
            <#if !realm.registrationEmailAsUsername>
                <div class="form-group">
                    <label for="username" class="form-label">
                        <span class="material-symbols-outlined label-icon">person</span>
                        <span>Username</span>
                    </label>
                    <div class="input-container">
                        <input 
                            tabindex="4" 
                            type="text" 
                            id="username" 
                            class="form-input" 
                            name="username" 
                            value="${(register.formData.username!'')}" 
                            autocomplete="username" 
                            placeholder="Choose unique username" 
                            required 
                        />
                    </div>
                </div>
            </#if>

            <!-- Password Input -->
            <#if passwordRequired??>
                <div class="form-group">
                    <label for="password" class="form-label">
                        <span class="material-symbols-outlined label-icon">key</span>
                        <span>Create Password</span>
                    </label>
                    <div class="input-container">
                        <input 
                            tabindex="5" 
                            type="password" 
                            id="password" 
                            class="form-input" 
                            name="password" 
                            autocomplete="new-password" 
                            placeholder="Minimum 6 characters" 
                            required 
                        />
                    </div>
                </div>

                <!-- Confirm Password -->
                <div class="form-group">
                    <label for="password-confirm" class="form-label">
                        <span class="material-symbols-outlined label-icon">check_circle</span>
                        <span>Confirm Password</span>
                    </label>
                    <div class="input-container">
                        <input 
                            tabindex="6" 
                            type="password" 
                            id="password-confirm" 
                            class="form-input" 
                            name="password-confirm" 
                            placeholder="Re-enter password to match" 
                            required 
                        />
                    </div>
                </div>
            </#if>

            <!-- Submit Registration Button -->
            <div class="form-actions">
                <button tabindex="7" class="btn-submit btn-primary" type="submit">
                    <span>Create Customer Account</span>
                    <span class="material-symbols-outlined btn-icon">how_to_reg</span>
                </button>
            </div>

            <!-- Back to Login -->
            <div class="auth-switch-box">
                <span class="switch-text">Already have an Indian Store account?</span>
                <a tabindex="8" class="switch-action-link" href="${url.loginUrl}">
                    Sign In
                </a>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
