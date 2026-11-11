package com.converge.converge_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class InstagramMediaResponse {
    private String id;
    private String caption;

    @JsonProperty("media_type")
    private String mediaType; // IMAGE, VIDEO, CAROUSEL_ALBUM

    @JsonProperty("media_product_type")
    private String mediaProductType; // REELS, FEED, STORY

    private String permalink;
    private String timestamp;

    @JsonProperty("like_count")
    private Long likeCount;

    @JsonProperty("comments_count")
    private Long commentsCount;

    private InstagramInsightsWrapper insights;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InstagramInsightsWrapper {
        private List<InsightItem> data;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InsightItem {
        private String name;
        private String period;
        private List<InsightValue> values;
        private String title;
        private String description;
        private String id;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InsightValue {
        private Long value;
    }
}
