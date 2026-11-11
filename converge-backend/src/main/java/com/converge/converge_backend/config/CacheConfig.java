package com.converge.converge_backend.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableCaching
public class CacheConfig {

    public static final String CACHE_OVERVIEW = "overview";
    public static final String CACHE_CREATORS = "creators";
    public static final String CACHE_CREATOR_DETAIL = "creatorDetail";
    public static final String CACHE_AGENCIES = "agencies";
    public static final String CACHE_CONTENT = "content";
    public static final String CACHE_CAMPAIGNS = "campaigns";
    public static final String CACHE_BRANDS = "brands";

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager(
                CACHE_OVERVIEW,
                CACHE_CREATORS,
                CACHE_CREATOR_DETAIL,
                CACHE_AGENCIES,
                CACHE_CONTENT,
                CACHE_CAMPAIGNS,
                CACHE_BRANDS
        );
    }
}
