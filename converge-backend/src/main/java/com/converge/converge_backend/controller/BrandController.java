package com.converge.converge_backend.controller;

import com.converge.converge_backend.config.CacheConfig;
import com.converge.converge_backend.entity.AgencyEntity;
import com.converge.converge_backend.entity.BrandEntity;
import com.converge.converge_backend.entity.CampaignEntity;
import com.converge.converge_backend.entity.ContentItemEntity;
import com.converge.converge_backend.entity.CreatorEntity;
import com.converge.converge_backend.entity.UserEntity;
import com.converge.converge_backend.repository.AgencyRepository;
import com.converge.converge_backend.repository.BrandRepository;
import com.converge.converge_backend.repository.CampaignRepository;
import com.converge.converge_backend.repository.ContentItemRepository;
import com.converge.converge_backend.repository.CreatorRepository;
import com.converge.converge_backend.repository.UserRepository;
import com.converge.converge_backend.service.CacheEvictionService;
import com.converge.converge_backend.service.EmailService;
import com.converge.converge_backend.service.InstagramService;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/brands")
public class BrandController {

    private final BrandRepository brandRepository;
    private final AgencyRepository agencyRepository;
    private final UserRepository userRepository;
    private final CreatorRepository creatorRepository;
    private final ContentItemRepository contentItemRepository;
    private final CampaignRepository campaignRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final CacheEvictionService cacheEvictionService;

    public BrandController(
            BrandRepository brandRepository,
            AgencyRepository agencyRepository,
            UserRepository userRepository,
            CreatorRepository creatorRepository,
            ContentItemRepository contentItemRepository,
            CampaignRepository campaignRepository,
            PasswordEncoder passwordEncoder,
            EmailService emailService,
            CacheEvictionService cacheEvictionService
    ) {
        this.brandRepository = brandRepository;
        this.agencyRepository = agencyRepository;
        this.userRepository = userRepository;
        this.creatorRepository = creatorRepository;
        this.contentItemRepository = contentItemRepository;
        this.campaignRepository = campaignRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.cacheEvictionService = cacheEvictionService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER')")
    @Cacheable(value = CacheConfig.CACHE_BRANDS, key = "#authentication != null ? #authentication.name : 'all'")
    public ResponseEntity<List<BrandEntity>> getAllBrands(org.springframework.security.core.Authentication authentication) {
        List<BrandEntity> visibleBrands = brandRepository.findAll().stream()
                .filter(b -> !"DELETED".equalsIgnoreCase(b.getStatus()))
                .toList();

        if (authentication != null && authentication.getName() != null) {
            UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
            if (caller != null && "BRAND_MANAGER".equalsIgnoreCase(caller.getRole())) {
                Long callerBrandId = caller.getBrandId();
                String callerBrandName = caller.getOrganizationName();
                return ResponseEntity.ok(visibleBrands.stream()
                        .filter(b -> (callerBrandId != null && callerBrandId.equals(b.getId()))
                                || (callerBrandName != null && callerBrandName.equalsIgnoreCase(b.getName())))
                        .toList());
            }
        }
        return ResponseEntity.ok(visibleBrands);
    }

    @PostMapping("/sync-templates")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<Map<String, String>> syncResendTemplates() {
        return ResponseEntity.ok(emailService.provisionResendTemplates());
    }

    @PostMapping
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<BrandEntity> createBrand(@RequestBody BrandEntity brand) {
        if (brand.getName() == null || brand.getName().isBlank()) {
            throw new RuntimeException("Brand Name is required.");
        }
        String brandName = brand.getName().trim();
        String managerEmail = brand.getPrimaryManagerEmail() != null && !brand.getPrimaryManagerEmail().isBlank()
                ? brand.getPrimaryManagerEmail().trim().toLowerCase()
                : (brand.getContactEmail() != null ? brand.getContactEmail().trim().toLowerCase() : "");

        if (managerEmail.isBlank()) {
            throw new RuntimeException("Brand Manager Email is required.");
        }

        if ("chaitanyamandviya7@gmail.com".equalsIgnoreCase(managerEmail)) {
            throw new RuntimeException("Security Policy: System Administrator email cannot be registered as a Brand Manager.");
        }

        // Enforce uniqueness: reject if a brand with this name already exists
        boolean brandNameExists = brandRepository.findAll().stream()
                .anyMatch(b -> b.getName() != null && b.getName().trim().equalsIgnoreCase(brandName));
        if (brandNameExists) {
            throw new RuntimeException("A Brand Workspace named '" + brandName + "' already exists.");
        }

        // Clean up any stale or orphaned user account with this email
        UserEntity existingUser = userRepository.findByEmail(managerEmail).orElse(null);
        if (existingUser != null) {
            if ("SYSTEM_ADMIN".equalsIgnoreCase(existingUser.getRole())) {
                throw new RuntimeException("Security Policy: System Administrator email cannot be used for a Brand Workspace.");
            }
            if (existingUser.getBrandId() != null && brandRepository.existsById(existingUser.getBrandId())) {
                throw new RuntimeException("An account with email '" + managerEmail + "' is already registered in an active workspace.");
            }
            userRepository.delete(existingUser);
        }

        // Always provision a brand-new BrandEntity (100% fresh, blank slate)
        BrandEntity newBrand = new BrandEntity();
        newBrand.setName(brandName);
        newBrand.setPrimaryManagerEmail(managerEmail);
        newBrand.setContactEmail(managerEmail);
        newBrand.setCategory(brand.getCategory() != null ? brand.getCategory() : "Lifestyle & Wellness");
        newBrand.setWebsiteUrl(brand.getWebsiteUrl());
        newBrand.setLogoUrl(brand.getLogoUrl());
        newBrand.setStatus("ACTIVE");
        BrandEntity saved = brandRepository.save(newBrand);

        // Provision brand-new Brand Manager user account
        UserEntity mgr = new UserEntity();
        mgr.setEmail(managerEmail);
        mgr.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        mgr.setRole("BRAND_MANAGER");
        mgr.setStatus("ACTIVE");
        mgr.setOrganizationName(saved.getName());
        mgr.setWebsiteUrl(saved.getWebsiteUrl());
        mgr.setLogoUrl(saved.getLogoUrl());
        mgr.setBrandId(saved.getId());
        userRepository.save(mgr);

        emailService.sendInvitationEmail(managerEmail, saved.getName(), "BRAND_MANAGER");
        cacheEvictionService.evictAll();
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<BrandEntity> updateBrand(@PathVariable Long id, @RequestBody BrandEntity payload) {
        BrandEntity brand = brandRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Brand not found"));

        String oldEmail = brand.getPrimaryManagerEmail() != null ? brand.getPrimaryManagerEmail().trim().toLowerCase() : null;

        if (payload.getName() != null && !payload.getName().isBlank()) {
            String trimmedName = payload.getName().trim();
            boolean nameExists = brandRepository.findAll().stream()
                    .anyMatch(b -> !b.getId().equals(id)
                            && !"DELETED".equalsIgnoreCase(b.getStatus())
                            && b.getName() != null && b.getName().trim().equalsIgnoreCase(trimmedName));
            if (nameExists) {
                throw new RuntimeException("A Brand Workspace named '" + trimmedName + "' already exists. Please choose a unique brand name.");
            }
            brand.setName(trimmedName);
        }
        if (payload.getPrimaryManagerEmail() != null && !payload.getPrimaryManagerEmail().isBlank()) {
            String newEmail = payload.getPrimaryManagerEmail().trim().toLowerCase();
            if ("chaitanyamandviya7@gmail.com".equalsIgnoreCase(newEmail)) {
                throw new RuntimeException("Security Policy: System Administrator email cannot be assigned to a Brand.");
            }
            if (!newEmail.equalsIgnoreCase(oldEmail)) {
                userRepository.findByEmail(newEmail).ifPresent(conflict -> {
                    if (!"DELETED".equalsIgnoreCase(conflict.getStatus())) {
                        throw new RuntimeException("Email '" + newEmail + "' is already assigned to another account.");
                    }
                });
            }
            brand.setPrimaryManagerEmail(newEmail);
            brand.setContactEmail(newEmail);
        }
        if (payload.getCategory() != null) {
            brand.setCategory(payload.getCategory().trim());
        }
        if (payload.getWebsiteUrl() != null) {
            brand.setWebsiteUrl(payload.getWebsiteUrl().trim());
        }
        if (payload.getLogoUrl() != null) {
            brand.setLogoUrl(payload.getLogoUrl().trim());
        }
        if (payload.getStatus() != null && !payload.getStatus().isBlank()) {
            brand.setStatus(payload.getStatus().trim());
        }

        BrandEntity saved = brandRepository.save(brand);

        // Sync Brand Manager user record(s)
        for (UserEntity user : userRepository.findAll()) {
            if ("SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) continue;
            boolean matchesId = id.equals(user.getBrandId()) && "BRAND_MANAGER".equalsIgnoreCase(user.getRole());
            boolean matchesEmail = oldEmail != null && user.getEmail() != null && user.getEmail().equalsIgnoreCase(oldEmail);
            if (matchesId || matchesEmail) {
                user.setEmail(saved.getPrimaryManagerEmail());
                user.setOrganizationName(saved.getName());
                user.setWebsiteUrl(saved.getWebsiteUrl());
                user.setLogoUrl(saved.getLogoUrl());
                user.setStatus(saved.getStatus());
                user.setBrandId(saved.getId());
                userRepository.save(user);
            }
        }

        cacheEvictionService.evictBrands();
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<BrandEntity> updateBrandStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        BrandEntity brand = brandRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Brand not found"));
        String newStatus = body.getOrDefault("status", "ACTIVE");
        brand.setStatus(newStatus);
        BrandEntity saved = brandRepository.save(brand);

        String mgrEmail = saved.getPrimaryManagerEmail() != null ? saved.getPrimaryManagerEmail().trim().toLowerCase() : "";
        for (UserEntity user : userRepository.findAll()) {
            if ("SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) continue;
            boolean matchesBrandMgr = "BRAND_MANAGER".equalsIgnoreCase(user.getRole())
                    && (id.equals(user.getBrandId())
                        || (!mgrEmail.isEmpty() && user.getEmail() != null && user.getEmail().equalsIgnoreCase(mgrEmail))
                        || (saved.getName() != null && saved.getName().equalsIgnoreCase(user.getOrganizationName())));
            if (matchesBrandMgr) {
                user.setStatus(newStatus);
                user.setBrandId(saved.getId());
                userRepository.save(user);
            }
        }
        cacheEvictionService.evictBrands();
        return ResponseEntity.ok(saved);
    }

    /**
     * Permanently purges a Brand: completely deletes the brand and cascades hard removal
     * to all associated agencies, creators, content items, campaigns, and manager accounts.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<Map<String, String>> deleteBrand(@PathVariable Long id) {
        BrandEntity brand = brandRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Brand not found"));

        String primaryEmail = brand.getPrimaryManagerEmail() != null ? brand.getPrimaryManagerEmail().trim().toLowerCase() : "";
        String contactEmail = brand.getContactEmail() != null ? brand.getContactEmail().trim().toLowerCase() : "";
        String brandName = brand.getName() != null ? brand.getName().trim() : "";

        // 1. Identify all agencies belonging to this brand
        List<AgencyEntity> brandAgencies = agencyRepository.findAll().stream()
                .filter(a -> id.equals(a.getBrandId())
                        || (!brandName.isEmpty() && a.getBrandName() != null && a.getBrandName().trim().equalsIgnoreCase(brandName)))
                .toList();

        Set<String> brandAgencyNames = brandAgencies.stream()
                .map(a -> a.getName() != null ? a.getName().trim().toLowerCase() : "")
                .filter(n -> !n.isEmpty())
                .collect(Collectors.toSet());

        Set<Long> brandAgencyIds = brandAgencies.stream()
                .map(AgencyEntity::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // 2. Identify all campaigns belonging to this brand
        List<CampaignEntity> brandCampaigns = campaignRepository.findAll().stream()
                .filter(c -> !brandName.isEmpty() && c.getBrandName() != null && brandName.equalsIgnoreCase(c.getBrandName().trim()))
                .toList();

        Set<Long> brandCampaignIds = brandCampaigns.stream()
                .map(CampaignEntity::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<String> brandCampaignNames = brandCampaigns.stream()
                .map(c -> c.getName() != null ? c.getName().trim().toLowerCase() : "")
                .filter(n -> !n.isEmpty())
                .collect(Collectors.toSet());

        // 3. Identify all creators linked to this brand or its agencies
        List<CreatorEntity> brandCreators = creatorRepository.findAll().stream()
                .filter(c -> (id.equals(c.getBrandId()))
                        || (!brandName.isEmpty() && c.getBrandName() != null && brandName.equalsIgnoreCase(c.getBrandName().trim()))
                        || (c.getAgencyName() != null && brandAgencyNames.contains(c.getAgencyName().trim().toLowerCase()))
                        || (!brandName.isEmpty() && c.getAgencyName() != null && brandName.equalsIgnoreCase(c.getAgencyName().trim()))
                        || (c.getCampaignId() != null && brandCampaignIds.contains(c.getCampaignId())))
                .toList();

        Set<String> brandCreatorHandles = brandCreators.stream()
                .map(c -> c.getHandle() != null ? InstagramService.normalizeHandle(c.getHandle()).toLowerCase() : "")
                .filter(h -> !h.isEmpty())
                .collect(Collectors.toSet());

        // 4. Permanently purge all content items / deliverables associated with this brand, its agencies, campaigns, or creators
        List<ContentItemEntity> itemsToDelete = contentItemRepository.findAll().stream()
                .filter(ci -> {
                    if (ci.getAgencyName() != null && brandAgencyNames.contains(ci.getAgencyName().trim().toLowerCase())) return true;
                    if (!brandName.isEmpty() && ci.getAgencyName() != null && brandName.equalsIgnoreCase(ci.getAgencyName().trim())) return true;
                    if (ci.getCampaignId() != null && brandCampaignIds.contains(ci.getCampaignId())) return true;
                    if (ci.getCampaignName() != null && brandCampaignNames.contains(ci.getCampaignName().trim().toLowerCase())) return true;
                    if (ci.getCreatorHandle() != null && brandCreatorHandles.contains(InstagramService.normalizeHandle(ci.getCreatorHandle()).toLowerCase())) return true;
                    return false;
                })
                .toList();
        if (!itemsToDelete.isEmpty()) {
            contentItemRepository.deleteAll(itemsToDelete);
        }

        // 5. Permanently purge creators
        if (!brandCreators.isEmpty()) {
            creatorRepository.deleteAll(brandCreators);
        }

        // 6. Permanently purge campaigns
        if (!brandCampaigns.isEmpty()) {
            campaignRepository.deleteAll(brandCampaigns);
        }

        // 7. Permanently purge agency users
        for (AgencyEntity ag : brandAgencies) {
            String agEmail = ag.getContactEmail() != null ? ag.getContactEmail().trim().toLowerCase() : "";
            String agName = ag.getName() != null ? ag.getName().trim() : "";
            List<UserEntity> agUsers = userRepository.findAll().stream()
                    .filter(u -> !"SYSTEM_ADMIN".equalsIgnoreCase(u.getRole()))
                    .filter(u -> (ag.getId() != null && ag.getId().equals(u.getAgencyId()))
                            || (!agEmail.isEmpty() && u.getEmail() != null && agEmail.equalsIgnoreCase(u.getEmail().trim()))
                            || ("AGENCY_MANAGER".equalsIgnoreCase(u.getRole()) && !agName.isEmpty() && agName.equalsIgnoreCase(u.getOrganizationName())))
                    .toList();
            if (!agUsers.isEmpty()) {
                userRepository.deleteAll(agUsers);
            }
        }

        // 8. Permanently purge agencies
        if (!brandAgencies.isEmpty()) {
            agencyRepository.deleteAll(brandAgencies);
        }

        // 9. Permanently purge Brand Manager user accounts
        List<UserEntity> brandUsers = userRepository.findAll().stream()
                .filter(u -> !"SYSTEM_ADMIN".equalsIgnoreCase(u.getRole()))
                .filter(u -> (id.equals(u.getBrandId()))
                        || (!primaryEmail.isEmpty() && u.getEmail() != null && primaryEmail.equalsIgnoreCase(u.getEmail().trim()))
                        || (!contactEmail.isEmpty() && u.getEmail() != null && contactEmail.equalsIgnoreCase(u.getEmail().trim()))
                        || ("BRAND_MANAGER".equalsIgnoreCase(u.getRole()) && !brandName.isEmpty() && brandName.equalsIgnoreCase(u.getOrganizationName())))
                .toList();
        if (!brandUsers.isEmpty()) {
            userRepository.deleteAll(brandUsers);
        }

        // 10. Permanently purge the Brand itself
        brandRepository.delete(brand);
        cacheEvictionService.evictAll();
        return ResponseEntity.ok(Map.of("message", "Brand workspace '" + brandName + "' and all associated agencies, creators, campaigns, and deliverables permanently purged."));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleBrandException(RuntimeException ex) {
        return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage() != null ? ex.getMessage() : "Operation failed"));
    }

    @PostMapping("/{id}/resend-invite")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<Map<String, String>> resendBrandInvite(@PathVariable Long id) {
        BrandEntity brand = brandRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Brand not found"));
        String email = brand.getPrimaryManagerEmail() != null ? brand.getPrimaryManagerEmail() : brand.getContactEmail();
        if (email == null || email.isBlank()) {
            throw new RuntimeException("No Brand Manager email configured for this brand.");
        }
        emailService.sendInvitationEmail(email.trim().toLowerCase(), brand.getName(), "BRAND_MANAGER");
        return ResponseEntity.ok(Map.of("message", "Invitation & Set-Password link sent to " + email));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<BrandEntity> approveBrand(@PathVariable Long id) {
        BrandEntity brand = brandRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Brand not found"));
        brand.setStatus("ACTIVE");
        BrandEntity saved = brandRepository.save(brand);

        String recipientEmail = brand.getPrimaryManagerEmail() != null ? brand.getPrimaryManagerEmail() : brand.getContactEmail();
        if (recipientEmail != null && !recipientEmail.isBlank()) {
            userRepository.findByEmail(recipientEmail.trim().toLowerCase())
                    .ifPresent(user -> {
                        if (!"SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) {
                            user.setStatus("ACTIVE");
                            user.setBrandId(saved.getId());
                            userRepository.save(user);
                        }
                    });
            emailService.sendApprovalConfirmationEmail(recipientEmail.trim().toLowerCase(), saved.getName(), "BRAND_MANAGER");
        }

        cacheEvictionService.evictBrands();
        return ResponseEntity.ok(saved);
    }
}
