package com.converge.converge_backend.controller;

import com.converge.converge_backend.config.CacheConfig;
import com.converge.converge_backend.dto.InviteAgencyRequest;
import com.converge.converge_backend.entity.AgencyEntity;
import com.converge.converge_backend.entity.BrandEntity;
import com.converge.converge_backend.entity.ContentItemEntity;
import com.converge.converge_backend.entity.CreatorEntity;
import com.converge.converge_backend.entity.UserEntity;
import com.converge.converge_backend.repository.AgencyRepository;
import com.converge.converge_backend.repository.BrandRepository;
import com.converge.converge_backend.repository.ContentItemRepository;
import com.converge.converge_backend.repository.CreatorRepository;
import com.converge.converge_backend.repository.UserRepository;
import com.converge.converge_backend.service.CacheEvictionService;
import com.converge.converge_backend.service.EmailService;
import com.converge.converge_backend.service.InstagramService;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/agencies")
public class AgencyController {

    private final AgencyRepository agencyRepository;
    private final BrandRepository brandRepository;
    private final UserRepository userRepository;
    private final CreatorRepository creatorRepository;
    private final ContentItemRepository contentItemRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final CacheEvictionService cacheEvictionService;

    public AgencyController(
            AgencyRepository agencyRepository,
            BrandRepository brandRepository,
            UserRepository userRepository,
            CreatorRepository creatorRepository,
            ContentItemRepository contentItemRepository,
            PasswordEncoder passwordEncoder,
            EmailService emailService,
            CacheEvictionService cacheEvictionService
    ) {
        this.agencyRepository = agencyRepository;
        this.brandRepository = brandRepository;
        this.userRepository = userRepository;
        this.creatorRepository = creatorRepository;
        this.contentItemRepository = contentItemRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.cacheEvictionService = cacheEvictionService;
    }

    @GetMapping
    @Cacheable(value = CacheConfig.CACHE_AGENCIES, key = "#authentication != null ? #authentication.name : 'all'")
    public ResponseEntity<List<AgencyEntity>> getAllAgencies(Authentication authentication) {
        Set<Long> deletedBrandIds = brandRepository.findAll().stream()
                .filter(b -> "DELETED".equalsIgnoreCase(b.getStatus()) && b.getId() != null)
                .map(BrandEntity::getId)
                .collect(Collectors.toSet());

        List<AgencyEntity> all = agencyRepository.findAll().stream()
                .filter(a -> !"DELETED".equalsIgnoreCase(a.getStatus()))
                .filter(a -> a.getBrandId() == null || !deletedBrandIds.contains(a.getBrandId()))
                .toList();

        if (authentication != null && authentication.getName() != null) {
            UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
            if (caller != null) {
                if ("BRAND_MANAGER".equalsIgnoreCase(caller.getRole())) {
                    Long callerBrandId = caller.getBrandId();
                    String callerBrandName = caller.getOrganizationName();
                    if ((callerBrandName == null || callerBrandName.isBlank()) && callerBrandId != null) {
                        callerBrandName = brandRepository.findById(callerBrandId).map(BrandEntity::getName).orElse(null);
                    }
                    final Long bId = callerBrandId;
                    final String bName = callerBrandName;
                    List<AgencyEntity> filtered = all.stream()
                            .filter(a -> (bId != null && bId.equals(a.getBrandId()))
                                    || (bName != null && a.getBrandName() != null && bName.equalsIgnoreCase(a.getBrandName().trim())))
                            .toList();
                    return ResponseEntity.ok(filtered);
                } else if ("AGENCY_MANAGER".equalsIgnoreCase(caller.getRole())) {
                    Long agencyId = caller.getAgencyId();
                    String agencyEmail = caller.getEmail() != null ? caller.getEmail().trim().toLowerCase() : "";
                    String agencyOrg = caller.getOrganizationName() != null ? caller.getOrganizationName().trim() : "";
                    List<AgencyEntity> filtered = all.stream()
                            .filter(a -> (agencyId != null && agencyId.equals(a.getId()))
                                    || (!agencyEmail.isEmpty() && a.getContactEmail() != null && agencyEmail.equalsIgnoreCase(a.getContactEmail().trim()))
                                    || (!agencyOrg.isEmpty() && a.getName() != null && agencyOrg.equalsIgnoreCase(a.getName().trim())))
                            .toList();
                    return ResponseEntity.ok(filtered);
                }
            }
        }
        return ResponseEntity.ok(all);
    }

    @PostMapping("/invite")
    @PreAuthorize("hasRole('BRAND_MANAGER')")
    public ResponseEntity<AgencyEntity> inviteAgency(@RequestBody InviteAgencyRequest request, Authentication authentication) {
        if (request.getName() == null || request.getName().isBlank()) {
            throw new RuntimeException("Agency Name is required.");
        }
        if (request.getContactEmail() == null || request.getContactEmail().isBlank()) {
            throw new RuntimeException("Agency Manager Email is required.");
        }
        String agencyName = request.getName().trim();
        String email = request.getContactEmail().trim().toLowerCase();
        if ("chaitanyamandviya7@gmail.com".equalsIgnoreCase(email)) {
            throw new RuntimeException("Security Policy: System Administrator email cannot be onboarded as an Agency.");
        }

        // Enforce uniqueness: check if an agency with this name or contact email already exists
        AgencyEntity existingByName = agencyRepository.findAll().stream()
                .filter(a -> a.getName() != null && a.getName().trim().equalsIgnoreCase(agencyName))
                .findFirst()
                .orElse(null);
        if (existingByName != null) {
            if (!"DELETED".equalsIgnoreCase(existingByName.getStatus())) {
                throw new RuntimeException("An agency named '" + agencyName + "' already exists. Please use a unique agency name.");
            }
            agencyRepository.delete(existingByName);
        }

        AgencyEntity existingByEmail = agencyRepository.findAll().stream()
                .filter(a -> a.getContactEmail() != null && a.getContactEmail().trim().equalsIgnoreCase(email))
                .findFirst()
                .orElse(null);
        if (existingByEmail != null) {
            if (!"DELETED".equalsIgnoreCase(existingByEmail.getStatus())) {
                throw new RuntimeException("An agency with email '" + email + "' is already registered in the system.");
            }
            agencyRepository.delete(existingByEmail);
        }

        // Clean up any stale or orphaned user account with this email
        UserEntity existingUser = userRepository.findByEmail(email).orElse(null);
        if (existingUser != null) {
            if ("SYSTEM_ADMIN".equalsIgnoreCase(existingUser.getRole())) {
                throw new RuntimeException("Security Policy: System Administrator email cannot be used for an Agency account.");
            }
            if (existingUser.getAgencyId() != null && agencyRepository.existsById(existingUser.getAgencyId())) {
                throw new RuntimeException("An account with email '" + email + "' is already registered in an active agency.");
            }
            userRepository.delete(existingUser);
        }

        String initials = agencyName.replaceAll("[^a-zA-Z]", "");
        initials = initials.length() >= 2 ? initials.substring(0, 2).toUpperCase() : "AG";

        // Always provision a brand-new AgencyEntity (100% fresh, blank slate)
        AgencyEntity agency = new AgencyEntity(
                null,
                agencyName,
                email,
                initials,
                0,
                "0 / 0",
                0.0,
                0L,
                0L,
                0L
        );

        if (request.getCategory() != null && !request.getCategory().isBlank()) {
            agency.setCategory(request.getCategory());
        }
        if (request.getWebsiteUrl() != null && !request.getWebsiteUrl().isBlank()) {
            agency.setWebsiteUrl(request.getWebsiteUrl().trim());
        }
        if (request.getLogoUrl() != null && !request.getLogoUrl().isBlank()) {
            agency.setLogoUrl(request.getLogoUrl().trim());
        }

        // Resolve associated Brand from request or logged-in Brand Manager
        Long resolvedBrandId = request.getBrandId();
        String resolvedBrandName = request.getBrandName();
        if (authentication != null && authentication.getName() != null) {
            UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
            if (caller != null) {
                if (resolvedBrandId == null && caller.getBrandId() != null) {
                    resolvedBrandId = caller.getBrandId();
                }
                if ((resolvedBrandName == null || resolvedBrandName.isBlank()) && caller.getOrganizationName() != null && !"SYSTEM_ADMIN".equalsIgnoreCase(caller.getRole())) {
                    resolvedBrandName = caller.getOrganizationName();
                }
            }
        }
        if (resolvedBrandId == null) {
            BrandEntity firstBrand = brandRepository.findAll().stream()
                    .filter(b -> !"DELETED".equalsIgnoreCase(b.getStatus()))
                    .findFirst()
                    .orElse(null);
            if (firstBrand != null) {
                resolvedBrandId = firstBrand.getId();
                resolvedBrandName = firstBrand.getName();
            }
        }
        if (resolvedBrandId != null) {
            agency.setBrandId(resolvedBrandId);
            if (resolvedBrandName == null || resolvedBrandName.isBlank()) {
                BrandEntity b = brandRepository.findById(resolvedBrandId).orElse(null);
                if (b != null) {
                    resolvedBrandName = b.getName();
                }
            }
            agency.setBrandName(resolvedBrandName);
        }

        agency.setStatus("ACTIVE");
        AgencyEntity saved = agencyRepository.save(agency);

        // Provision brand-new Agency Manager user account & send Set Initial Password link via Resend
        UserEntity agencyUser = new UserEntity();
        agencyUser.setEmail(email);
        agencyUser.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        agencyUser.setRole("AGENCY_MANAGER");
        agencyUser.setOrganizationName(saved.getName());
        agencyUser.setWebsiteUrl(saved.getWebsiteUrl());
        agencyUser.setLogoUrl(saved.getLogoUrl());
        agencyUser.setStatus("ACTIVE");
        agencyUser.setAgencyId(saved.getId());
        agencyUser.setBrandId(saved.getBrandId());
        userRepository.save(agencyUser);

        emailService.sendInvitationEmail(email, saved.getName(), "AGENCY_MANAGER");
        cacheEvictionService.evictAll();
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('BRAND_MANAGER', 'SYSTEM_ADMIN')")
    public ResponseEntity<AgencyEntity> updateAgency(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        AgencyEntity agency = agencyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Agency not found"));

        String oldEmail = agency.getContactEmail() != null ? agency.getContactEmail().trim().toLowerCase() : null;
        String oldName = agency.getName() != null ? agency.getName().trim() : null;

        if (payload.get("name") instanceof String name && !name.isBlank()) {
            String trimmedName = name.trim();
            boolean nameExists = agencyRepository.findAll().stream()
                    .anyMatch(a -> !a.getId().equals(id)
                            && !"DELETED".equalsIgnoreCase(a.getStatus())
                            && a.getName() != null && a.getName().trim().equalsIgnoreCase(trimmedName));
            if (nameExists) {
                throw new RuntimeException("An agency named '" + trimmedName + "' already exists. Please choose a unique agency name.");
            }
            agency.setName(trimmedName);
            String initials = trimmedName.replaceAll("[^a-zA-Z]", "");
            agency.setInitials(initials.length() >= 2 ? initials.substring(0, 2).toUpperCase() : "AG");
        }
        if (payload.get("email") instanceof String email && !email.isBlank()) {
            String clean = email.trim().toLowerCase();
            if ("chaitanyamandviya7@gmail.com".equalsIgnoreCase(clean)) {
                throw new RuntimeException("Security Policy: System Administrator email cannot be assigned to an Agency.");
            }
            agency.setContactEmail(clean);
        } else if (payload.get("contactEmail") instanceof String contactEmail && !contactEmail.isBlank()) {
            String clean = contactEmail.trim().toLowerCase();
            if ("chaitanyamandviya7@gmail.com".equalsIgnoreCase(clean)) {
                throw new RuntimeException("Security Policy: System Administrator email cannot be assigned to an Agency.");
            }
            agency.setContactEmail(clean);
        }
        if (payload.get("category") instanceof String category) {
            agency.setCategory(category.trim());
        }
        if (payload.get("websiteUrl") instanceof String websiteUrl) {
            agency.setWebsiteUrl(websiteUrl.trim());
        }
        if (payload.get("logoUrl") instanceof String logoUrl) {
            agency.setLogoUrl(logoUrl.trim());
        }
        if (payload.get("spend") instanceof Number spend) {
            agency.setAgreedSpend(spend.doubleValue());
        } else if (payload.get("agreedSpend") instanceof Number agreedSpend) {
            agency.setAgreedSpend(agreedSpend.doubleValue());
        }
        if (payload.get("status") instanceof String status && !status.isBlank()) {
            agency.setStatus(status.trim());
        }
        if (payload.get("brandId") instanceof Number brandIdNum) {
            Long bId = brandIdNum.longValue();
            agency.setBrandId(bId);
            brandRepository.findById(bId).ifPresent(b -> agency.setBrandName(b.getName()));
        }

        AgencyEntity saved = agencyRepository.save(agency);

        for (UserEntity user : userRepository.findAll()) {
            if ("SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) continue;
            boolean matchesId = id.equals(user.getAgencyId());
            boolean matchesEmail = oldEmail != null && user.getEmail() != null && user.getEmail().equalsIgnoreCase(oldEmail);
            boolean matchesOrg = "AGENCY_MANAGER".equalsIgnoreCase(user.getRole())
                    && oldName != null
                    && user.getOrganizationName() != null
                    && user.getOrganizationName().trim().equalsIgnoreCase(oldName);
            if (matchesId || matchesEmail || matchesOrg) {
                user.setEmail(saved.getContactEmail());
                user.setOrganizationName(saved.getName());
                user.setWebsiteUrl(saved.getWebsiteUrl());
                user.setLogoUrl(saved.getLogoUrl());
                user.setStatus(saved.getStatus());
                user.setAgencyId(saved.getId());
                user.setBrandId(saved.getBrandId());
                userRepository.save(user);
            }
        }

        cacheEvictionService.evictAgencies();
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('BRAND_MANAGER', 'SYSTEM_ADMIN')")
    public ResponseEntity<AgencyEntity> updateAgencyStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        AgencyEntity agency = agencyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Agency not found"));
        String newStatus = body.getOrDefault("status", "ACTIVE");
        agency.setStatus(newStatus);
        AgencyEntity saved = agencyRepository.save(agency);

        String contactEmail = saved.getContactEmail() != null ? saved.getContactEmail().trim().toLowerCase() : "";
        String agencyName = saved.getName() != null ? saved.getName().trim() : "";

        for (UserEntity user : userRepository.findAll()) {
            if ("SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) continue;
            boolean matchesAgencyUser = id.equals(user.getAgencyId())
                    || (!contactEmail.isEmpty() && user.getEmail() != null && user.getEmail().equalsIgnoreCase(contactEmail))
                    || ("AGENCY_MANAGER".equalsIgnoreCase(user.getRole()) && !agencyName.isEmpty() && agencyName.equalsIgnoreCase(user.getOrganizationName()));
            if (matchesAgencyUser) {
                user.setStatus(newStatus);
                user.setAgencyId(saved.getId());
                userRepository.save(user);
            }
        }

        cacheEvictionService.evictAgencies();
        return ResponseEntity.ok(saved);
    }

    /**
     * Permanently purges an Agency: deletes the agency entity and cascades hard removal
     * to all associated creators, deliverables, and manager accounts.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('BRAND_MANAGER', 'SYSTEM_ADMIN')")
    public ResponseEntity<Map<String, String>> deleteAgency(@PathVariable Long id) {
        AgencyEntity agency = agencyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Agency not found"));

        String contactEmail = agency.getContactEmail() != null ? agency.getContactEmail().trim().toLowerCase() : "";
        String agencyName = agency.getName() != null ? agency.getName().trim() : "";

        // 1. Delete all content items belonging to this agency
        if (!agencyName.isEmpty()) {
            List<ContentItemEntity> itemsToDelete = contentItemRepository.findAll().stream()
                    .filter(ci -> ci.getAgencyName() != null && agencyName.equalsIgnoreCase(ci.getAgencyName().trim()))
                    .toList();
            if (!itemsToDelete.isEmpty()) {
                contentItemRepository.deleteAll(itemsToDelete);
            }

            // 2. Delete creators belonging to this agency and their deliverables
            List<CreatorEntity> creatorsToDelete = creatorRepository.findAll().stream()
                    .filter(c -> c.getAgencyName() != null && agencyName.equalsIgnoreCase(c.getAgencyName().trim()))
                    .toList();
            for (CreatorEntity c : creatorsToDelete) {
                if (c.getHandle() != null) {
                    String norm = InstagramService.normalizeHandle(c.getHandle());
                    List<ContentItemEntity> extraItems = contentItemRepository.findAll().stream()
                            .filter(ci -> ci.getCreatorHandle() != null && InstagramService.normalizeHandle(ci.getCreatorHandle()).equalsIgnoreCase(norm))
                            .toList();
                    if (!extraItems.isEmpty()) {
                        contentItemRepository.deleteAll(extraItems);
                    }
                }
            }
            if (!creatorsToDelete.isEmpty()) {
                creatorRepository.deleteAll(creatorsToDelete);
            }
        }

        // 3. Delete Agency Manager user accounts
        List<UserEntity> agencyUsers = userRepository.findAll().stream()
                .filter(u -> !"SYSTEM_ADMIN".equalsIgnoreCase(u.getRole()))
                .filter(u -> (id.equals(u.getAgencyId()))
                        || (!contactEmail.isEmpty() && u.getEmail() != null && contactEmail.equalsIgnoreCase(u.getEmail().trim()))
                        || ("AGENCY_MANAGER".equalsIgnoreCase(u.getRole()) && !agencyName.isEmpty() && agencyName.equalsIgnoreCase(u.getOrganizationName())))
                .toList();
        if (!agencyUsers.isEmpty()) {
            userRepository.deleteAll(agencyUsers);
        }

        // 4. Permanently delete the agency entity
        agencyRepository.delete(agency);
        cacheEvictionService.evictAll();
        return ResponseEntity.ok(Map.of("message", "Agency '" + agencyName + "' and all associated creators, deliverables, and manager accounts permanently purged."));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleAgencyException(RuntimeException ex) {
        return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage() != null ? ex.getMessage() : "Operation failed"));
    }

    @PostMapping("/{id}/resend-invite")
    @PreAuthorize("hasAnyRole('BRAND_MANAGER', 'SYSTEM_ADMIN')")
    public ResponseEntity<Map<String, String>> resendAgencyInvite(@PathVariable Long id) {
        AgencyEntity agency = agencyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Agency not found"));
        if (agency.getContactEmail() == null || agency.getContactEmail().isBlank()) {
            throw new RuntimeException("No email configured for this agency.");
        }
        emailService.sendInvitationEmail(agency.getContactEmail().trim().toLowerCase(), agency.getName(), "AGENCY_MANAGER");
        return ResponseEntity.ok(Map.of("message", "Invitation & Set-Password link sent to " + agency.getContactEmail()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('BRAND_MANAGER', 'SYSTEM_ADMIN')")
    public ResponseEntity<AgencyEntity> approveAgency(@PathVariable Long id) {
        AgencyEntity agency = agencyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Agency not found"));
        agency.setStatus("ACTIVE");
        AgencyEntity saved = agencyRepository.save(agency);

        if (agency.getContactEmail() != null) {
            String email = agency.getContactEmail().trim().toLowerCase();
            userRepository.findByEmail(email)
                    .ifPresent(user -> {
                        if (!"SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) {
                            user.setStatus("ACTIVE");
                            user.setAgencyId(saved.getId());
                            userRepository.save(user);
                        }
                    });
            emailService.sendApprovalConfirmationEmail(email, saved.getName(), "AGENCY_MANAGER");
        }

        cacheEvictionService.evictAgencies();
        return ResponseEntity.ok(saved);
    }
}
