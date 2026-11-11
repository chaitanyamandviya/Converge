package com.converge.converge_backend.dto;

import com.converge.converge_backend.entity.ContentItemEntity;
import com.converge.converge_backend.entity.CreatorEntity;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreatorDetailDto {
    private CreatorEntity creator;
    private List<ContentItemEntity> contentItems;
}
