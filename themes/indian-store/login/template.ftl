<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="robots" content="noindex, nofollow">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign In - Indian Store Portal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
</head>
<body class="indian-store-auth-body">
    <div class="auth-wrapper">
        <div class="auth-ambient-glow"></div>
        <div class="auth-ambient-glow-secondary"></div>
        
        <div class="auth-card">
            <!-- Brand Header -->
            <div class="auth-brand">
                <div class="brand-badge">
                    <span class="flag-icon">🇮🇳</span>
                    <span class="badge-text">Authentic Indian Store</span>
                </div>
                <h1 class="brand-title">Indian Store</h1>
                <p class="brand-subtitle">Staff & Management IAM Access Portal</p>
            </div>

            <!-- Error / Feedback Alert Box -->
            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                <div class="auth-alert alert-${message.type}">
                    <span class="material-symbols-outlined alert-icon">
                        <#if message.type = 'success'>check_circle<#elseif message.type = 'warning'>warning<#elseif message.type = 'error'>error<#else>info</#if>
                    </span>
                    <span class="alert-message">${kcSanitize(message.summary)?no_esc}</span>
                </div>
            </#if>

            <!-- Main Form Content -->
            <div class="auth-form-body">
                <#nested "form">
            </div>

            <!-- Security Footer -->
            <div class="auth-footer">
                <div class="security-badge">
                    <span class="material-symbols-outlined sec-icon">lock</span>
                    <span>Protected by Keycloak IAM & Role-Based Access Control</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
</#macro>
