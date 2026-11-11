package com.converge.converge_backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AddContentRequest {
    private String creatorHandle;
    private String agencyName;
    private Long campaignId;
    private String campaignName;
    private String title;
    private String contentUrl;
    private String thumbnailUrl;
    private String format;
    private long views;
    private long likes;
    private long comments;
    private double finalPrice;

    public void setViews(Long views) {
        this.views = views != null ? views : 0L;
    }

    public void setLikes(Long likes) {
        this.likes = likes != null ? likes : 0L;
    }

    public void setComments(Long comments) {
        this.comments = comments != null ? comments : 0L;
    }

    public void setFinalPrice(Double finalPrice) {
        this.finalPrice = finalPrice != null ? finalPrice : 0.0;
    }
}
