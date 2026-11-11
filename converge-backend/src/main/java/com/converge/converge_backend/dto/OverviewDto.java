package com.converge.converge_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import com.converge.converge_backend.entity.CampaignEntity;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverviewDto {
    private String campaignName;
    private Long activeCampaignId;
    private String brandName;
    private String timeframe;
    private int agenciesCount;
    private int creatorsCount;
    private String contentRatio;
    private double totalAgreedSpend;
    private long views;
    private long likes;
    private long comments;
    private int missingUrlsCount;
    private int awaitingInsightsCount;
    private int coveragePercent;
    private List<WeeklyTrendPoint> weeklyTrends;
    private List<CampaignEntity> campaigns;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WeeklyTrendPoint {
        private String weekLabel;
        private long views;
        private long engagements;
    }
}
