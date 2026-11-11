package com.converge.converge_backend.service;

import com.converge.converge_backend.config.CacheConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

@Service
public class CacheEvictionService {

    private static final Logger log = LoggerFactory.getLogger(CacheEvictionService.class);
    private final CacheManager cacheManager;

    public CacheEvictionService(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    public void evictAll() {
        for (String name : cacheManager.getCacheNames()) {
            clear(name);
        }
        log.info("[CACHE] Cleared all caches.");
    }

    public void evictOverview() {
        clear(CacheConfig.CACHE_OVERVIEW);
    }

    public void evictCreators() {
        clear(CacheConfig.CACHE_CREATORS);
        clear(CacheConfig.CACHE_CREATOR_DETAIL);
        clear(CacheConfig.CACHE_OVERVIEW);
        clear(CacheConfig.CACHE_CONTENT);
        log.info("[CACHE] Evicted creators and overview caches.");
    }

    public void evictAgencies() {
        clear(CacheConfig.CACHE_AGENCIES);
        clear(CacheConfig.CACHE_OVERVIEW);
        clear(CacheConfig.CACHE_CREATORS);
        clear(CacheConfig.CACHE_CREATOR_DETAIL);
        clear(CacheConfig.CACHE_CONTENT);
        log.info("[CACHE] Evicted agencies, creators, content, and overview caches.");
    }

    public void evictContent() {
        clear(CacheConfig.CACHE_CONTENT);
        clear(CacheConfig.CACHE_CREATORS);
        clear(CacheConfig.CACHE_CREATOR_DETAIL);
        clear(CacheConfig.CACHE_OVERVIEW);
        log.info("[CACHE] Evicted content, creators, and overview caches.");
    }

    public void evictCampaigns() {
        clear(CacheConfig.CACHE_CAMPAIGNS);
        clear(CacheConfig.CACHE_OVERVIEW);
        log.info("[CACHE] Evicted campaigns and overview caches.");
    }

    public void evictBrands() {
        clear(CacheConfig.CACHE_BRANDS);
        clear(CacheConfig.CACHE_AGENCIES);
        clear(CacheConfig.CACHE_CREATORS);
        clear(CacheConfig.CACHE_CREATOR_DETAIL);
        clear(CacheConfig.CACHE_CAMPAIGNS);
        clear(CacheConfig.CACHE_CONTENT);
        clear(CacheConfig.CACHE_OVERVIEW);
        log.info("[CACHE] Evicted brands, agencies, creators, campaigns, and overview caches.");
    }

    private void clear(String cacheName) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.clear();
        }
    }
}
