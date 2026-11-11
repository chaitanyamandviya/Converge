package com.converge.converge_backend.service;

import com.converge.converge_backend.dto.AuthRequest;
import com.converge.converge_backend.dto.AuthResponse;
import com.converge.converge_backend.entity.AgencyEntity;
import com.converge.converge_backend.entity.BrandEntity;
import com.converge.converge_backend.entity.UserEntity;
import com.converge.converge_backend.repository.AgencyRepository;
import com.converge.converge_backend.repository.BrandRepository;
import com.converge.converge_backend.repository.UserRepository;
import com.converge.converge_backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final BrandRepository brandRepository;
    private final AgencyRepository agencyRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;

    public AuthService(
            UserRepository userRepository,
            BrandRepository brandRepository,
            AgencyRepository agencyRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService
    ) {
        this.userRepository = userRepository;
        this.brandRepository = brandRepository;
        this.agencyRepository = agencyRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
    }

    public AuthResponse login(AuthRequest request) {
        UserEntity user = userRepository.findByEmail(request.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new RuntimeException("Invalid email or password."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid email or password.");
        }

        validateActiveWorkspaceForUser(user);

        String token = jwtService.generateToken(
                user.getEmail(),
                user.getRole(),
                user.getBrandId(),
                user.getAgencyId()
        );

        String orgName = resolveOrganizationName(user);
        String logoUrl = resolveLogoUrl(user);
        return new AuthResponse(token, user.getRole(), user.getEmail(), user.getBrandId(), user.getAgencyId(), "ACTIVE", orgName, logoUrl);
    }

    /**
     * Verifies that both the UserEntity and its underlying BrandEntity / AgencyEntity
     * are ACTIVE and not DELETED or DEACTIVATED. Preserves all database records (soft-delete).
     */
    private void validateActiveWorkspaceForUser(UserEntity user) {
        if ("SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) {
            return;
        }

        if ("DELETED".equalsIgnoreCase(user.getStatus())) {
            throw new RuntimeException("This workspace has been removed. Your account access has been revoked.");
        }
        if ("PENDING_APPROVAL".equalsIgnoreCase(user.getStatus())) {
            if ("BRAND_MANAGER".equalsIgnoreCase(user.getRole())) {
                throw new RuntimeException("Your Brand workspace is pending approval by the System Administrator.");
            } else {
                throw new RuntimeException("Your Agency workspace is pending approval by the Brand Manager.");
            }
        }
        if ("DEACTIVATED".equalsIgnoreCase(user.getStatus()) || "INACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new RuntimeException("Your workspace account is currently deactivated. Please contact your administrator.");
        }

        if ("BRAND_MANAGER".equalsIgnoreCase(user.getRole())) {
            BrandEntity brand = resolveBrandForUser(user);
            if (brand == null || "DELETED".equalsIgnoreCase(brand.getStatus())) {
                user.setStatus("DELETED");
                userRepository.save(user);
                throw new RuntimeException("This Brand workspace has been removed. Your account access has been revoked.");
            }
            if ("PENDING_APPROVAL".equalsIgnoreCase(brand.getStatus())) {
                throw new RuntimeException("Your Brand workspace is pending approval by the System Administrator.");
            }
            if ("DEACTIVATED".equalsIgnoreCase(brand.getStatus()) || "INACTIVE".equalsIgnoreCase(brand.getStatus())) {
                throw new RuntimeException("Your Brand workspace is currently deactivated. Please contact the System Administrator.");
            }
            if (!brand.getId().equals(user.getBrandId())) {
                user.setBrandId(brand.getId());
                userRepository.save(user);
            }
        } else if ("AGENCY_MANAGER".equalsIgnoreCase(user.getRole())) {
            AgencyEntity agency = resolveAgencyForUser(user);
            if (agency == null || "DELETED".equalsIgnoreCase(agency.getStatus())) {
                user.setStatus("DELETED");
                userRepository.save(user);
                throw new RuntimeException("This Agency workspace has been removed. Your account access has been revoked.");
            }
            if ("PENDING_APPROVAL".equalsIgnoreCase(agency.getStatus())) {
                throw new RuntimeException("Your Agency workspace is pending approval by the Brand Manager.");
            }
            if ("DEACTIVATED".equalsIgnoreCase(agency.getStatus()) || "INACTIVE".equalsIgnoreCase(agency.getStatus())) {
                throw new RuntimeException("Your Agency workspace is currently deactivated. Please contact your Brand Manager.");
            }
            if (agency.getBrandId() != null) {
                BrandEntity parentBrand = brandRepository.findById(agency.getBrandId()).orElse(null);
                if (parentBrand == null || "DELETED".equalsIgnoreCase(parentBrand.getStatus())) {
                    agency.setStatus("DELETED");
                    agencyRepository.save(agency);
                    user.setStatus("DELETED");
                    userRepository.save(user);
                    throw new RuntimeException("The parent Brand workspace for this agency has been removed. Access is revoked.");
                }
                if ("DEACTIVATED".equalsIgnoreCase(parentBrand.getStatus()) || "INACTIVE".equalsIgnoreCase(parentBrand.getStatus())) {
                    throw new RuntimeException("The parent Brand workspace for this agency is currently deactivated.");
                }
            }
            if (!agency.getId().equals(user.getAgencyId())) {
                user.setAgencyId(agency.getId());
                userRepository.save(user);
            }
        }
    }

    private BrandEntity resolveBrandForUser(UserEntity user) {
        if (user.getBrandId() != null) {
            BrandEntity byId = brandRepository.findById(user.getBrandId()).orElse(null);
            if (byId != null) {
                return byId;
            }
        }
        String email = user.getEmail() != null ? user.getEmail().trim().toLowerCase() : "";
        String org = user.getOrganizationName() != null ? user.getOrganizationName().trim() : "";
        return brandRepository.findAll().stream()
                .filter(b -> (b.getPrimaryManagerEmail() != null && b.getPrimaryManagerEmail().trim().equalsIgnoreCase(email))
                        || (b.getContactEmail() != null && b.getContactEmail().trim().equalsIgnoreCase(email))
                        || (!org.isEmpty() && b.getName() != null && b.getName().trim().equalsIgnoreCase(org)))
                .findFirst()
                .orElse(null);
    }

    private AgencyEntity resolveAgencyForUser(UserEntity user) {
        if (user.getAgencyId() != null) {
            AgencyEntity byId = agencyRepository.findById(user.getAgencyId()).orElse(null);
            if (byId != null) {
                return byId;
            }
        }
        String email = user.getEmail() != null ? user.getEmail().trim().toLowerCase() : "";
        String org = user.getOrganizationName() != null ? user.getOrganizationName().trim() : "";
        return agencyRepository.findAll().stream()
                .filter(a -> (a.getContactEmail() != null && a.getContactEmail().trim().equalsIgnoreCase(email))
                        || (!org.isEmpty() && a.getName() != null && a.getName().trim().equalsIgnoreCase(org)))
                .findFirst()
                .orElse(null);
    }

    private String resolveOrganizationName(UserEntity user) {
        if (user.getOrganizationName() != null && !user.getOrganizationName().isBlank()) {
            return user.getOrganizationName().trim();
        }
        if ("BRAND_MANAGER".equalsIgnoreCase(user.getRole())) {
            BrandEntity b = resolveBrandForUser(user);
            if (b != null && b.getName() != null) return b.getName().trim();
        } else if ("AGENCY_MANAGER".equalsIgnoreCase(user.getRole())) {
            AgencyEntity a = resolveAgencyForUser(user);
            if (a != null && a.getName() != null) return a.getName().trim();
        } else if ("SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) {
            return "Converge System Admin";
        }
        return "Workspace";
    }

    private String resolveLogoUrl(UserEntity user) {
        if (user.getLogoUrl() != null && !user.getLogoUrl().isBlank()) {
            return user.getLogoUrl().trim();
        }
        if ("BRAND_MANAGER".equalsIgnoreCase(user.getRole())) {
            BrandEntity b = resolveBrandForUser(user);
            if (b != null && b.getLogoUrl() != null) return b.getLogoUrl().trim();
        } else if ("AGENCY_MANAGER".equalsIgnoreCase(user.getRole())) {
            AgencyEntity a = resolveAgencyForUser(user);
            if (a != null && a.getLogoUrl() != null) return a.getLogoUrl().trim();
        }
        return null;
    }

    public java.util.Map<String, Object> getCurrentUserProfile(String email) {
        UserEntity user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new RuntimeException("User not found"));
        String org = resolveOrganizationName(user);
        String logo = resolveLogoUrl(user);
        return java.util.Map.of(
                "email", user.getEmail(),
                "role", user.getRole(),
                "fullName", user.getFullName() != null ? user.getFullName() : "",
                "organizationName", org != null ? org : "",
                "brandId", user.getBrandId() != null ? user.getBrandId() : 0,
                "agencyId", user.getAgencyId() != null ? user.getAgencyId() : 0,
                "logoUrl", logo != null ? logo : "",
                "status", user.getStatus() != null ? user.getStatus() : "ACTIVE"
        );
    }

    public AuthResponse register(AuthRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        if ("chaitanyamandviya7@gmail.com".equalsIgnoreCase(email)) {
            throw new RuntimeException("Security Policy: System Administrator email cannot be used for Brand or Agency onboarding.");
        }
        UserEntity existingUser = userRepository.findByEmail(email).orElse(null);
        if (existingUser != null && !"DELETED".equalsIgnoreCase(existingUser.getStatus())) {
            throw new RuntimeException("An account with this email already exists.");
        }

        String role = (request.getRole() != null && !request.getRole().isBlank())
                ? request.getRole()
                : "BRAND_MANAGER";

        if (request.getOrganizationName() == null || request.getOrganizationName().isBlank()) {
            throw new RuntimeException(
                    "BRAND_MANAGER".equalsIgnoreCase(role)
                            ? "Brand Name is required for onboarding."
                            : "Agency Name is required for onboarding."
            );
        }

        String orgName = request.getOrganizationName().trim();
        String websiteUrl = (request.getWebsiteUrl() != null && !request.getWebsiteUrl().isBlank())
                ? request.getWebsiteUrl().trim()
                : null;
        String category = (request.getCategory() != null && !request.getCategory().isBlank())
                ? request.getCategory().trim()
                : "Lifestyle & Wellness";

        UserEntity user = existingUser != null ? existingUser : new UserEntity();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(role);
        user.setFullName(request.getFullName());
        user.setOrganizationName(orgName);
        user.setWebsiteUrl(websiteUrl);
        user.setStatus("PENDING_APPROVAL");

        String approverEmail = null;
        String partnerBrandName = null;

        if ("BRAND_MANAGER".equalsIgnoreCase(role)) {
            BrandEntity existingBrand = brandRepository.findAll().stream()
                    .filter(b -> b.getName() != null && b.getName().trim().equalsIgnoreCase(orgName))
                    .findFirst()
                    .orElse(null);
            BrandEntity brand = existingBrand != null ? existingBrand : new BrandEntity();
            brand.setName(orgName);
            brand.setContactEmail(email);
            brand.setPrimaryManagerEmail(email);
            brand.setCategory(category);
            brand.setWebsiteUrl(websiteUrl);
            brand.setActiveCampaignsCount(0);
            brand.setTotalBudgetDeployed(0.0);
            brand.setStatus("PENDING_APPROVAL");
            BrandEntity savedBrand = brandRepository.save(brand);
            user.setBrandId(savedBrand.getId());
        } else if ("AGENCY_MANAGER".equalsIgnoreCase(role)) {
            String initials = orgName.replaceAll("[^a-zA-Z]", "");
            initials = initials.length() >= 2 ? initials.substring(0, 2).toUpperCase() : "AG";

            AgencyEntity existingAgency = agencyRepository.findAll().stream()
                    .filter(a -> a.getContactEmail() != null && a.getContactEmail().trim().equalsIgnoreCase(email))
                    .findFirst()
                    .orElse(null);

            AgencyEntity agency = existingAgency != null ? existingAgency : new AgencyEntity(
                    null,
                    orgName,
                    email,
                    initials,
                    0,
                    "0 / 0",
                    0.0,
                    0L,
                    0L,
                    0L
            );
            agency.setName(orgName);
            agency.setContactEmail(email);
            agency.setInitials(initials);
            agency.setCategory(category);
            agency.setWebsiteUrl(websiteUrl);
            agency.setStatus("PENDING_APPROVAL");

            BrandEntity selectedBrand = null;
            if (request.getBrandId() != null) {
                selectedBrand = brandRepository.findById(request.getBrandId()).orElse(null);
            }
            if (selectedBrand == null) {
                selectedBrand = brandRepository.findAll().stream()
                        .filter(b -> !"DEACTIVATED".equalsIgnoreCase(b.getStatus()) && !"DELETED".equalsIgnoreCase(b.getStatus()))
                        .findFirst()
                        .orElse(null);
            }
            if (selectedBrand != null) {
                agency.setBrandId(selectedBrand.getId());
                agency.setBrandName(selectedBrand.getName());
                user.setBrandId(selectedBrand.getId());
                partnerBrandName = selectedBrand.getName();
                approverEmail = selectedBrand.getPrimaryManagerEmail();
            }

            AgencyEntity savedAgency = agencyRepository.save(agency);
            user.setAgencyId(savedAgency.getId());
        }

        userRepository.save(user);

        emailService.sendOnboardingApplicationEmails(
                email,
                request.getFullName(),
                orgName,
                role,
                websiteUrl,
                approverEmail,
                partnerBrandName
        );

        return new AuthResponse(null, user.getRole(), user.getEmail(), user.getBrandId(), user.getAgencyId(), "PENDING_APPROVAL", orgName, null);
    }

    public void forgotPassword(String email, String newPassword) {
        if (email == null || email.isBlank()) {
            throw new RuntimeException("Please enter your email address.");
        }
        String cleanEmail = email.trim().toLowerCase();
        UserEntity user = userRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> new RuntimeException("No active workspace account found with this email address."));

        if ("DELETED".equalsIgnoreCase(user.getStatus())) {
            throw new RuntimeException("This workspace has been removed. Password reset is unavailable.");
        }
        if ("BRAND_MANAGER".equalsIgnoreCase(user.getRole())) {
            BrandEntity brand = resolveBrandForUser(user);
            if (brand == null || "DELETED".equalsIgnoreCase(brand.getStatus())) {
                user.setStatus("DELETED");
                userRepository.save(user);
                throw new RuntimeException("This Brand workspace has been removed. Password reset is unavailable.");
            }
        }
        if ("AGENCY_MANAGER".equalsIgnoreCase(user.getRole())) {
            AgencyEntity agency = resolveAgencyForUser(user);
            if (agency == null || "DELETED".equalsIgnoreCase(agency.getStatus())) {
                user.setStatus("DELETED");
                userRepository.save(user);
                throw new RuntimeException("This Agency workspace has been removed. Password reset is unavailable.");
            }
        }

        if (newPassword != null && !newPassword.isBlank()) {
            user.setPassword(passwordEncoder.encode(newPassword));
            userRepository.save(user);
        }
        emailService.sendPasswordResetEmail(cleanEmail);
    }

    public void submitFeedback(String senderEmail, String message) {
        if (message == null || message.isBlank()) {
            throw new RuntimeException("Please enter a message.");
        }
        emailService.sendFeedbackOrQueryEmail(senderEmail, message.trim());
    }

    public AuthResponse googleLogin(AuthRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("No registered workspace account found for " + email + ". Please onboard your Brand or Agency first."));

        validateActiveWorkspaceForUser(user);

        String token = jwtService.generateToken(
                user.getEmail(),
                user.getRole(),
                user.getBrandId(),
                user.getAgencyId()
        );

        String orgName = resolveOrganizationName(user);
        String logoUrl = resolveLogoUrl(user);
        return new AuthResponse(token, user.getRole(), user.getEmail(), user.getBrandId(), user.getAgencyId(), "ACTIVE", orgName, logoUrl);
    }
}
