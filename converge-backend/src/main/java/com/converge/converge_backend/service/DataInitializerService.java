package com.converge.converge_backend.service;

import com.converge.converge_backend.entity.*;
import com.converge.converge_backend.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
public class DataInitializerService implements CommandLineRunner {

    private final UserRepository userRepository;
    private final BrandRepository brandRepository;
    private final AgencyRepository agencyRepository;
    private final CreatorRepository creatorRepository;
    private final ContentItemRepository contentItemRepository;
    private final CampaignRepository campaignRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;
    private final InstagramService instagramService;

    @Value("${app.reset-db:false}")
    private boolean resetDb;

    public DataInitializerService(
            UserRepository userRepository,
            BrandRepository brandRepository,
            AgencyRepository agencyRepository,
            CreatorRepository creatorRepository,
            ContentItemRepository contentItemRepository,
            CampaignRepository campaignRepository,
            PasswordEncoder passwordEncoder,
            JdbcTemplate jdbcTemplate,
            InstagramService instagramService) {
        this.userRepository = userRepository;
        this.brandRepository = brandRepository;
        this.agencyRepository = agencyRepository;
        this.creatorRepository = creatorRepository;
        this.contentItemRepository = contentItemRepository;
        this.campaignRepository = campaignRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
        this.instagramService = instagramService;
    }

    @Override
    public void run(String... args) {
        widenUrlColumnsToText();
        if (resetDb) {
            wipeAllTables();
        }
        purgeDemoDataFromDatabase();
        cleanupSoftDeletedLegacyRecords();
        deduplicateBrandsAndAgencies();
        enforceUniqueIndexes();
        purgeOrphanedManagerAccounts();
        seedPrimarySystemAdmin();
        sanitizeSystemAdminIsolation();
        syncExistingContentItems();
    }

    private void wipeAllTables() {
        String[] tables = { "content_items", "creators", "campaigns", "agencies", "brands", "users" };
        for (String table : tables) {
            try {
                jdbcTemplate.execute("TRUNCATE TABLE " + table + " RESTART IDENTITY CASCADE");
            } catch (Exception ignored) {
                // Fallback to JPA deleteAll below
            }
        }
        contentItemRepository.deleteAll();
        creatorRepository.deleteAll();
        campaignRepository.deleteAll();
        agencyRepository.deleteAll();
        brandRepository.deleteAll();
        userRepository.deleteAll();
    }

    private void syncExistingContentItems() {
        for (ContentItemEntity item : contentItemRepository.findAll()) {
            try {
                if (item.getContentUrl() != null && !item.getContentUrl().isBlank()) {
                    String rawUrl = item.getContentUrl().trim();
                    // If item has concatenated URLs, pick the correct one based on title/idx
                    if (rawUrl.contains(" ")) {
                        String[] parts = rawUrl.split("\\s+");
                        if (item.getTitle() != null && item.getTitle().contains("#2") && parts.length > 2) {
                            item.setContentUrl(parts[2]);
                        } else if (parts.length > 1) {
                            item.setContentUrl(parts[1]);
                        } else {
                            item.setContentUrl(parts[0]);
                        }
                        if (item.getContentUrl().contains("/reel/")) {
                            item.setFormat("Instagram Reel");
                        } else if (item.getContentUrl().contains("/p/")) {
                            item.setFormat("Instagram Post");
                        }
                        contentItemRepository.save(item);
                    }

                    if ("MISSING_URL".equalsIgnoreCase(item.getStatus())
                            || item.getViews() == 0
                            || item.getViews() == 4805
                            || item.getThumbnailUrl() == null
                            || item.getThumbnailUrl().isBlank()
                            || (item.getFormat() != null && item.getFormat().contains(" "))) {
                        instagramService.syncContentItem(item);
                    }
                }
            } catch (Exception ignored) {
                // Ignore transient race conditions on startup
            }
        }
        for (CreatorEntity creator : creatorRepository.findAll()) {
            try {
                instagramService.rollUpCreatorMetrics(creator.getHandle());
            } catch (Exception ignored) {
            }
        }
    }

    private void widenUrlColumnsToText() {
        String[] ddl = {
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS followers_count BIGINT DEFAULT 0",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS follows_count BIGINT DEFAULT 0",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS media_count BIGINT DEFAULT 0",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Micro'",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS creator_type TEXT DEFAULT 'Influencer'",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS audience_fit INT DEFAULT 5",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS content_quality INT DEFAULT 5",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS authenticity_risk TEXT DEFAULT 'Low'",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS pricing_model TEXT DEFAULT 'PER_DELIVERABLE'",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS min_price DOUBLE PRECISION",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS max_price DOUBLE PRECISION",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS campaign_id BIGINT",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS campaign_name TEXT",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS brand_id BIGINT",
                "ALTER TABLE creators ADD COLUMN IF NOT EXISTS brand_name TEXT",
                "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS assigned_agency_names TEXT",
                "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS campaign_id BIGINT",
                "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS campaign_name TEXT",
                "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT",
                "ALTER TABLE content_items ALTER COLUMN thumbnail_url TYPE TEXT",
                "ALTER TABLE creators ALTER COLUMN avatar_url TYPE TEXT",
                "ALTER TABLE creators ALTER COLUMN profile_url TYPE TEXT",
                "ALTER TABLE creators ALTER COLUMN name TYPE TEXT",
                "ALTER TABLE creators ALTER COLUMN agency_name TYPE TEXT",
                "ALTER TABLE creators ALTER COLUMN category TYPE TEXT",
                "ALTER TABLE creators ALTER COLUMN platform TYPE TEXT",
                "ALTER TABLE creators ALTER COLUMN content_slots TYPE TEXT",
                "ALTER TABLE content_items ALTER COLUMN content_url TYPE TEXT",
                "ALTER TABLE content_items ALTER COLUMN title TYPE TEXT",
                "ALTER TABLE content_items ALTER COLUMN creator_handle TYPE TEXT",
                "ALTER TABLE content_items ALTER COLUMN agency_name TYPE TEXT",
                "ALTER TABLE content_items ALTER COLUMN format TYPE TEXT",
                "ALTER TABLE brands ALTER COLUMN website_url TYPE TEXT",
                "ALTER TABLE brands ALTER COLUMN name TYPE TEXT",
                "ALTER TABLE agencies ALTER COLUMN website_url TYPE TEXT",
                "ALTER TABLE agencies ALTER COLUMN name TYPE TEXT",
                "ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_url TEXT",
                "ALTER TABLE agencies ADD COLUMN IF NOT EXISTS logo_url TEXT",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url TEXT"
        };
        for (String sql : ddl) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception ignored) {
                // Ignore if column doesn't exist yet or is already TEXT
            }
        }
    }

    private void cleanupSoftDeletedLegacyRecords() {
        for (BrandEntity b : brandRepository.findAll()) {
            if ("DELETED".equalsIgnoreCase(b.getStatus())) {
                brandRepository.delete(b);
            }
        }
        for (AgencyEntity a : agencyRepository.findAll()) {
            if ("DELETED".equalsIgnoreCase(a.getStatus())) {
                agencyRepository.delete(a);
            }
        }
        for (CampaignEntity c : campaignRepository.findAll()) {
            if ("DELETED".equalsIgnoreCase(c.getStatus())) {
                campaignRepository.delete(c);
            }
        }
        for (UserEntity u : userRepository.findAll()) {
            if ("DELETED".equalsIgnoreCase(u.getStatus()) && !"SYSTEM_ADMIN".equalsIgnoreCase(u.getRole())) {
                userRepository.delete(u);
            }
        }
    }

    private void purgeOrphanedManagerAccounts() {
        List<BrandEntity> brands = brandRepository.findAll();
        List<AgencyEntity> agencies = agencyRepository.findAll();

        for (UserEntity user : userRepository.findAll()) {
            if ("SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) {
                continue;
            }
            String email = user.getEmail() != null ? user.getEmail().trim().toLowerCase() : "";
            String org = user.getOrganizationName() != null ? user.getOrganizationName().trim() : "";

            if ("BRAND_MANAGER".equalsIgnoreCase(user.getRole())) {
                boolean brandExistsAndActive = brands.stream().anyMatch(b ->
                        !"DELETED".equalsIgnoreCase(b.getStatus()) && (
                                (user.getBrandId() != null && user.getBrandId().equals(b.getId()))
                                        || (b.getPrimaryManagerEmail() != null && b.getPrimaryManagerEmail().trim().equalsIgnoreCase(email))
                                        || (b.getContactEmail() != null && b.getContactEmail().trim().equalsIgnoreCase(email))
                                        || (!org.isEmpty() && b.getName() != null && b.getName().trim().equalsIgnoreCase(org))
                        )
                );
                if (!brandExistsAndActive) {
                    userRepository.delete(user);
                }
            } else if ("AGENCY_MANAGER".equalsIgnoreCase(user.getRole())) {
                boolean agencyExistsAndActive = agencies.stream().anyMatch(a ->
                        !"DELETED".equalsIgnoreCase(a.getStatus()) && (
                                (user.getAgencyId() != null && user.getAgencyId().equals(a.getId()))
                                        || (a.getContactEmail() != null && a.getContactEmail().trim().equalsIgnoreCase(email))
                                        || (!org.isEmpty() && a.getName() != null && a.getName().trim().equalsIgnoreCase(org))
                        )
                );
                if (!agencyExistsAndActive) {
                    userRepository.delete(user);
                }
            }
        }
    }

    private void purgeDemoDataFromDatabase() {
        // 1. Remove demo users
        Set<String> demoUserEmails = Set.of(
                "admin@converge.io",
                "jamie@aster.com",
                "sarah@northcollective.co"
        );
        for (String email : demoUserEmails) {
            userRepository.findByEmail(email).ifPresent(userRepository::delete);
        }

        // 2. Remove demo agencies or any agency erroneously created with the System Admin email
        Set<String> demoAgencyNames = Set.of(
                "North Collective",
                "Social House",
                "Studio Eight",
                "Kindred Talent"
        );
        for (AgencyEntity agency : agencyRepository.findAll()) {
            boolean isDemo = agency.getName() != null && demoAgencyNames.contains(agency.getName());
            boolean usesAdminEmail = "chaitanyamandviya7@gmail.com".equalsIgnoreCase(agency.getContactEmail());
            if (isDemo || usesAdminEmail) {
                agencyRepository.delete(agency);
            }
        }

        // 3. Remove demo brands or any brand erroneously created with the System Admin email
        for (BrandEntity brand : brandRepository.findAll()) {
            boolean isDemo = "Aster & Co.".equalsIgnoreCase(brand.getName());
            boolean usesAdminEmail = "chaitanyamandviya7@gmail.com".equalsIgnoreCase(brand.getPrimaryManagerEmail())
                    || "chaitanyamandviya7@gmail.com".equalsIgnoreCase(brand.getContactEmail());
            if (isDemo || usesAdminEmail) {
                brandRepository.delete(brand);
            }
        }

        // 4. Remove demo campaign
        campaignRepository.findByName("Autumn essentials").ifPresent(campaignRepository::delete);

        // 5. Remove demo creators
        Set<String> demoCreatorHandles = Set.of(
                "@emma.rose",
                "@sophia.chen",
                "@marcus.vance",
                "@elena.rodriguez",
                "@lucas.kim",
                "@maya.patel",
                "@liam.ward",
                "@snigskinn"
        );
        // 5. Remove demo creators only
        for (CreatorEntity creator : creatorRepository.findAll()) {
            boolean isDemoHandle = creator.getHandle() != null && demoCreatorHandles.contains(creator.getHandle().toLowerCase());
            if (isDemoHandle) {
                creatorRepository.delete(creator);
            }
        }

        // 6. Remove demo content items only
        for (ContentItemEntity item : contentItemRepository.findAll()) {
            boolean isDemoHandle = item.getCreatorHandle() != null && demoCreatorHandles.contains(item.getCreatorHandle().toLowerCase());
            if (isDemoHandle) {
                contentItemRepository.delete(item);
            }
        }
    }

    private void deduplicateBrandsAndAgencies() {
        // 1. Deduplicate Brands (case-insensitive trimmed name)
        java.util.Map<String, List<BrandEntity>> brandsByName = new java.util.LinkedHashMap<>();
        for (BrandEntity b : brandRepository.findAll()) {
            if (b.getName() == null || b.getName().isBlank()) continue;
            String key = b.getName().trim().toLowerCase();
            brandsByName.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(b);
        }
        for (List<BrandEntity> group : brandsByName.values()) {
            if (group.size() <= 1) continue;
            group.sort((a, b) -> {
                boolean aActive = "ACTIVE".equalsIgnoreCase(a.getStatus());
                boolean bActive = "ACTIVE".equalsIgnoreCase(b.getStatus());
                if (aActive != bActive) return aActive ? -1 : 1;
                return Long.compare(a.getId() != null ? a.getId() : 0L, b.getId() != null ? b.getId() : 0L);
            });
            BrandEntity keep = group.get(0);
            for (int i = 1; i < group.size(); i++) {
                BrandEntity dup = group.get(i);
                Long dupId = dup.getId();
                for (UserEntity u : userRepository.findAll()) {
                    if (!"SYSTEM_ADMIN".equalsIgnoreCase(u.getRole()) && dupId.equals(u.getBrandId())) {
                        u.setBrandId(keep.getId());
                        userRepository.save(u);
                    }
                }
                for (AgencyEntity a : agencyRepository.findAll()) {
                    if (dupId.equals(a.getBrandId())) {
                        a.setBrandId(keep.getId());
                        a.setBrandName(keep.getName());
                        agencyRepository.save(a);
                    }
                }
                brandRepository.delete(dup);
            }
        }

        // 2. Deduplicate Agencies (case-insensitive trimmed name)
        java.util.Map<String, List<AgencyEntity>> agenciesByName = new java.util.LinkedHashMap<>();
        for (AgencyEntity a : agencyRepository.findAll()) {
            if (a.getName() == null || a.getName().isBlank()) continue;
            String key = a.getName().trim().toLowerCase();
            agenciesByName.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(a);
        }
        for (List<AgencyEntity> group : agenciesByName.values()) {
            if (group.size() <= 1) continue;
            group.sort((a, b) -> {
                boolean aActive = "ACTIVE".equalsIgnoreCase(a.getStatus());
                boolean bActive = "ACTIVE".equalsIgnoreCase(b.getStatus());
                if (aActive != bActive) return aActive ? -1 : 1;
                return Long.compare(a.getId() != null ? a.getId() : 0L, b.getId() != null ? b.getId() : 0L);
            });
            AgencyEntity keep = group.get(0);
            for (int i = 1; i < group.size(); i++) {
                AgencyEntity dup = group.get(i);
                Long dupId = dup.getId();
                for (UserEntity u : userRepository.findAll()) {
                    if (!"SYSTEM_ADMIN".equalsIgnoreCase(u.getRole()) && dupId.equals(u.getAgencyId())) {
                        u.setAgencyId(keep.getId());
                        userRepository.save(u);
                    }
                }
                agencyRepository.delete(dup);
            }
        }
    }

    private void enforceUniqueIndexes() {
        String[] ddl = {
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_name_lower ON brands (LOWER(TRIM(name)))",
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_agencies_name_lower ON agencies (LOWER(TRIM(name)))"
        };
        for (String sql : ddl) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception ignored) {
                // Ignore if index creation fails on non-Postgres or legacy constraint conflict
            }
        }
    }

    private void sanitizeSystemAdminIsolation() {
        try {
            jdbcTemplate.execute("UPDATE users SET brand_id = NULL, agency_id = NULL, organization_name = 'Converge System Admin' WHERE UPPER(role) = 'SYSTEM_ADMIN'");
        } catch (Exception ignored) {
        }
        for (UserEntity admin : userRepository.findByRole("SYSTEM_ADMIN")) {
            admin.setBrandId(null);
            admin.setAgencyId(null);
            admin.setOrganizationName("Converge System Admin");
            admin.setStatus("ACTIVE");
            userRepository.save(admin);

            String adminEmail = admin.getEmail() != null ? admin.getEmail().trim().toLowerCase() : "";
            if (!adminEmail.isEmpty()) {
                for (AgencyEntity a : agencyRepository.findAll()) {
                    if (a.getContactEmail() != null && adminEmail.equalsIgnoreCase(a.getContactEmail().trim())) {
                        agencyRepository.delete(a);
                    }
                }
                for (BrandEntity b : brandRepository.findAll()) {
                    if ((b.getPrimaryManagerEmail() != null && adminEmail.equalsIgnoreCase(b.getPrimaryManagerEmail().trim()))
                            || (b.getContactEmail() != null && adminEmail.equalsIgnoreCase(b.getContactEmail().trim()))) {
                        brandRepository.delete(b);
                    }
                }
            }
        }
    }

    private void seedPrimarySystemAdmin() {
        String primaryAdminEmail = "chaitanyamandviya7@gmail.com";
        UserEntity primaryAdmin = userRepository.findByEmail(primaryAdminEmail).orElseGet(UserEntity::new);
        primaryAdmin.setEmail(primaryAdminEmail);
        primaryAdmin.setFullName("Chaitanya Mandviya");
        primaryAdmin.setOrganizationName("Converge System Admin");
        primaryAdmin.setRole("SYSTEM_ADMIN");
        primaryAdmin.setStatus("ACTIVE");
        primaryAdmin.setBrandId(null);
        primaryAdmin.setAgencyId(null);
        if (primaryAdmin.getId() == null || primaryAdmin.getPassword() == null || primaryAdmin.getPassword().isBlank()) {
            primaryAdmin.setPassword(passwordEncoder.encode("Admin@12345"));
        }
        userRepository.save(primaryAdmin);

        // Ensure only 1 SYSTEM_ADMIN exists
        List<UserEntity> allAdmins = userRepository.findByRole("SYSTEM_ADMIN");
        for (UserEntity u : allAdmins) {
            if (!primaryAdminEmail.equalsIgnoreCase(u.getEmail())) {
                userRepository.delete(u);
            }
        }
    }
}
