<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="robots" content="noindex, nofollow">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Customer Sign In - Indian Store</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
</head>
<body class="customer-light-body">
    <div class="customer-split-container">
        
        <!-- ========================================================
             LEFT COLUMN: Product Showcase & Visual Marketing Hero
             ======================================================== -->
        <div class="auth-showcase">
            <div class="showcase-bg-image"></div>
            <div class="showcase-gradient-overlay"></div>
            
            <div class="showcase-content">
                <!-- Top Brand Tag -->
                <div class="showcase-tag">
                    <span class="flag-emoji">🇮🇳</span>
                    <span class="tag-label">Authentic Indian Groceries</span>
                </div>

                <!-- Showcase Headline & Captions -->
                <div class="showcase-hero-text">
                    <h2 class="hero-headline">Taste of Home, Delivered in Minutes</h2>
                    <p class="hero-subtext">
                        Discover 1,000+ pantry essentials, aged royal Basmati, stone-ground whole spices, pure Desi ghee, and artisanal festive sweets.
                    </p>
                </div>

                <!-- Key Highlights & Perks -->
                <div class="showcase-perks">
                    <div class="perk-card">
                        <div class="perk-icon-circle">
                            <span class="material-symbols-outlined">bolt</span>
                        </div>
                        <div class="perk-info">
                            <strong>Fast Express Delivery</strong>
                            <span>2-Hour doorstep delivery across metro areas</span>
                        </div>
                    </div>

                    <div class="perk-card">
                        <div class="perk-icon-circle">
                            <span class="material-symbols-outlined">eco</span>
                        </div>
                        <div class="perk-info">
                            <strong>100% Pure & Authentic</strong>
                            <span>Directly sourced from trusted Indian farms</span>
                        </div>
                    </div>

                    <div class="perk-card">
                        <div class="perk-icon-circle">
                            <span class="material-symbols-outlined">percent</span>
                        </div>
                        <div class="perk-info">
                            <strong>Festive Rewards & Discounts</strong>
                            <span>Get up to 20% OFF on pantry bundles</span>
                        </div>
                    </div>
                </div>

                <!-- Customer Social Proof Strip -->
                <div class="showcase-proof">
                    <div class="rating-stars">
                        <span class="material-symbols-outlined filled-star">star</span>
                        <span class="material-symbols-outlined filled-star">star</span>
                        <span class="material-symbols-outlined filled-star">star</span>
                        <span class="material-symbols-outlined filled-star">star</span>
                        <span class="material-symbols-outlined filled-star">star</span>
                    </div>
                    <span class="proof-text">Loved by <strong>25,000+</strong> happy families</span>
                </div>
            </div>
        </div>

        <!-- ========================================================
             RIGHT COLUMN: Customer Authentication Form (Light Mode)
             ======================================================== -->
        <div class="auth-form-column">
            <div class="form-inner-wrapper">
                <!-- Brand Header -->
                <div class="auth-brand-header">
                    <div class="brand-logo-row">
                        <div class="brand-logo-badge">
                            <span class="material-symbols-outlined brand-icon">shopping_bag</span>
                        </div>
                        <div class="brand-headings">
                            <h1 class="brand-title">Indian Store</h1>
                            <span class="portal-badge">Customer Account</span>
                        </div>
                    </div>

                    <p class="brand-page-desc">
                        <#if pageId?? && pageId == "login">
                            Welcome back! Sign in to continue shopping & manage your orders.
                        <#elseif pageId?? && pageId == "register">
                            Create your account to unlock member discounts & instant checkout.
                        <#elseif pageId?? && pageId == "login-reset-password">
                            Enter your email to receive password recovery instructions.
                        <#else>
                            Sign in to access your Indian Store customer account.
                        </#if>
                    </p>
                </div>

                <!-- Notification / Error / Success Message Box -->
                <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                    <div class="auth-alert alert-${message.type}">
                        <span class="material-symbols-outlined alert-icon">
                            <#if message.type = 'success'>check_circle<#elseif message.type = 'warning'>warning<#elseif message.type = 'error'>error<#else>info</#if>
                        </span>
                        <span class="alert-message">${kcSanitize(message.summary)?no_esc}</span>
                    </div>
                </#if>

                <!-- Form Content Body -->
                <div class="auth-form-body">
                    <#nested "form">
                </div>

                <!-- Footer Trust Strip -->
                <div class="auth-footer-trust">
                    <span class="material-symbols-outlined sec-icon">lock</span>
                    <span>256-Bit SSL Encrypted & Protected by Keycloak IAM</span>
                </div>
            </div>
        </div>

    </div>
</body>
</html>
</#macro>
