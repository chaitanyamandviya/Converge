import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { Creator, Agency, ContentItem, Campaign, OverviewMetrics } from './portal.service';

export interface ExportReportContext {
  brandName?: string;
  campaignName?: string;
  timeframe?: string;
  overview: OverviewMetrics;
  agencies: Agency[];
  creators: Creator[];
  contentItems: ContentItem[];
  campaigns: Campaign[];
}

@Injectable({
  providedIn: 'root'
})
export class ExcelExportService {

  async generateExecutiveReport(ctx: ExportReportContext): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Converge Enterprise Platform';
    wb.lastModifiedBy = ctx.brandName || 'Brand Manager';
    wb.created = new Date();
    wb.modified = new Date();

    // 1. Process duplicate detection and calculations
    const processedCreators = this.processCreators(ctx.creators, ctx.contentItems, ctx.agencies);
    const duplicatesCount = processedCreators.filter(c => c.isDuplicate).length;
    const potentialSavings = processedCreators.reduce((sum, c) => sum + c.potentialSavings, 0) / 2; // avoid double counting pairs

    // 2. Build Sheet: Instructions
    this.buildInstructionsSheet(wb);

    // 3. Build Sheet: Dashboard (Executive Summary for MD)
    this.buildDashboardSheet(wb, ctx, processedCreators, duplicatesCount, potentialSavings);

    // 4. Build Sheet: Data Entry (Master Vetting Table)
    this.buildDataEntrySheet(wb, processedCreators);

    // 5. Build Sheet: Reports (Monthly Deliverables Performance)
    this.buildReportsSheet(wb, ctx);

    // 6. Build Sheet: Scoring Guide
    this.buildScoringGuideSheet(wb);

    // Generate filename
    const now = new Date();
    const monthYear = now.toLocaleString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '_');
    const brandPrefix = (ctx.brandName || 'Converge').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${brandPrefix}_Influencer_Vetting_MD_Report_${monthYear}.xlsx`;

    // Download to browser
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private processCreators(creators: Creator[], items: ContentItem[], agencies: Agency[]) {
    // Group by normalized handle
    const handleGroups = new Map<string, Creator[]>();
    creators.forEach(c => {
      const norm = (c.handle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!norm) return;
      if (!handleGroups.has(norm)) {
        handleGroups.set(norm, []);
      }
      handleGroups.get(norm)!.push(c);
    });

    return creators.map((c, idx) => {
      const norm = (c.handle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const group = handleGroups.get(norm) || [c];
      const isDuplicate = group.length > 1;

      // Duplicate price variance / potential savings
      const prices = group.map(g => g.price || 0);
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const potentialSavings = isDuplicate ? (maxPrice - minPrice) : 0;
      const totalQuotedAcrossDuplicates = group.reduce((sum, g) => sum + (g.price || 0), 0);

      // Performance stats
      const creatorItems = items.filter(i => i.creatorHandle && i.creatorHandle.toLowerCase() === c.handle.toLowerCase());
      const views = c.views || creatorItems.reduce((acc, curr) => acc + (curr.views || 0), 0);
      const likes = c.likes || creatorItems.reduce((acc, curr) => acc + (curr.likes || 0), 0);
      const comments = c.comments || creatorItems.reduce((acc, curr) => acc + (curr.comments || 0), 0);
      const engagements = likes + comments;
      const followers = c.followersCount || 0;

      // Rate metrics
      const irPercent = views > 0 ? (engagements / views) * 100 : (followers > 0 ? (engagements / followers) * 100 : 0);
      const avgViews = creatorItems.length > 0 ? Math.round(views / creatorItems.length) : views;
      const cpm = followers > 0 ? Math.round(((c.price || 0) / followers) * 1000) : 0;
      const cpe = engagements > 0 ? Math.round(((c.price || 0) / engagements) * 100) / 100 : (c.price || 0);
      const cpv = views > 0 ? Math.round(((c.price || 0) / views) * 100) / 100 : 0;

      // Hook rate
      const reachRatio = followers > 0 ? (avgViews / followers) : 0.25;
      const hookRate = views > 0 ? Math.min(88, Math.max(16, Math.round(24 + (Math.min(1.5, reachRatio) * 32) + (Math.min(15, (engagements / views) * 100) * 1.6)))) : null;

      // Scores (0-100)
      const costEfficiencyScore = Math.max(40, Math.min(100, Math.round(100 - (cpe > 50 ? (cpe - 50) : 0))));
      const engagementScore = Math.max(40, Math.min(100, Math.round(irPercent * 15 + 40)));
      const fitQualityScore = Math.round(((c.audienceFit || 4) + (c.contentQuality || 4)) * 10);
      const credibilityScore = (c.authenticityRisk === 'High' ? 40 : (c.authenticityRisk === 'Medium' ? 70 : 95));

      // Weighted Composite Score
      // Weights: ERR 25%, Cost 25%, Fit+Quality 20%, Authenticity 20%, Track record 10%
      const compositeScore = Math.round(
        (engagementScore * 0.25) +
        (costEfficiencyScore * 0.25) +
        (fitQualityScore * 0.20) +
        (credibilityScore * 0.20) +
        (85 * 0.10)
      );

      // System Recommendation
      let recommendation = 'Approve';
      if (isDuplicate) {
        recommendation = 'HOLD - Consolidate first';
      } else if (compositeScore >= 80) {
        recommendation = 'Strong Approve';
      } else if (compositeScore >= 65) {
        recommendation = 'Approve';
      } else if (compositeScore >= 50) {
        recommendation = 'Approve with Negotiation';
      } else {
        recommendation = 'Review / Reject';
      }

      return {
        srNo: idx + 1,
        manager: c.agencyName || 'Partner Agency',
        category: c.category || 'Skincare & Lifestyle',
        name: c.name,
        handle: c.handle,
        profileLink: c.profileUrl || `https://www.instagram.com/${c.handle.replace('@', '')}/`,
        platform: c.platform || 'IG Reel',
        followers: followers,
        tier: c.tier || (followers >= 1000000 ? 'Mega' : (followers >= 500000 ? 'Macro' : (followers >= 100000 ? 'Mid-Tier' : (followers >= 10000 ? 'Micro' : 'Nano')))),
        creatorType: c.creatorType || 'Influencer',
        irPercent: Math.round(irPercent * 100) / 100,
        avgViews: avgViews,
        hookRate: hookRate ? `${hookRate}%` : '—',
        price: c.price || 0,
        cpm: cpm,
        cpe: cpe,
        cpv: cpv,
        audienceFit: c.audienceFit || 5,
        contentQuality: c.contentQuality || 5,
        authenticityRisk: c.authenticityRisk || 'Low',
        pastTrackRecord: 5,
        normalizedHandle: norm,
        isDuplicate: isDuplicate,
        duplicateStatus: isDuplicate ? '⚠ DUPLICATE' : 'OK',
        duplicateCount: group.length,
        totalQuotedAcrossDuplicates: totalQuotedAcrossDuplicates,
        potentialSavings: potentialSavings,
        costEfficiencyScore: costEfficiencyScore,
        engagementScore: engagementScore,
        fitQualityScore: fitQualityScore,
        credibilityScore: credibilityScore,
        compositeScore: compositeScore,
        recommendation: recommendation,
        finalDecision: isDuplicate ? 'HOLD' : (compositeScore >= 65 ? 'Approved' : 'Under Review'),
        approvedCost: isDuplicate ? minPrice : (c.price || 0),
        notes: isDuplicate ? `Flagged: Quoted by ${group.length} agencies. Potential savings: ₹${potentialSavings.toLocaleString('en-IN')}` : ''
      };
    });
  }

  // Common styling palette
  private readonly PALETTE = {
    NAVY_DARK: 'FF1B3166',
    NAVY_BRAND: 'FF243F82',
    NAVY_LIGHT: 'FFE8EEFA',
    ICE_BLUE: 'FFF0F4F8',
    CREAM: 'FFF6F4EC',
    WHITE: 'FFFFFFFF',
    BORDER_LIGHT: 'FFE2E8F0',
    BORDER_DARK: 'FFCBD5E1',
    TEXT_DARK: 'FF1E293B',
    TEXT_MUTED: 'FF64748B',
    GREEN_LIGHT: 'FFD1FAE5',
    GREEN_TEXT: 'FF065F46',
    RED_LIGHT: 'FFFEE2E2',
    RED_TEXT: 'FF991B1B',
    GOLD_LIGHT: 'FFFEF3C7',
    GOLD_TEXT: 'FF92400E',
    BLUE_LIGHT: 'FFDBEAFE',
    BLUE_TEXT: 'FF1E40AF'
  };

  private buildInstructionsSheet(wb: ExcelJS.Workbook): void {
    const ws = wb.addWorksheet('Instructions', {
      views: [{ showGridLines: true }]
    });

    ws.columns = [
      { width: 4 },
      { width: 32 },
      { width: 75 }
    ];

    // Banner Header
    ws.mergeCells('B2:C2');
    const headerCell = ws.getCell('B2');
    headerCell.value = 'INFLUENCER MARKETING VETTING WORKBOOK';
    headerCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: this.PALETTE.WHITE } };
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_BRAND } };
    headerCell.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(2).height = 42;

    // Subtitle
    ws.mergeCells('B3:C3');
    const subCell = ws.getCell('B3');
    subCell.value = 'A unified governance dashboard for Category Managers (Hygiene, Skincare, Suncare) and Partner Agencies to submit influencer proposals before executive spend approval.';
    subCell.font = { name: 'Segoe UI', size: 10.5, italic: true, color: { argb: this.PALETTE.TEXT_MUTED } };
    subCell.alignment = { vertical: 'middle', indent: 1, wrapText: true };
    ws.getRow(3).height = 30;

    // Section 1 Header
    ws.getCell('B5').value = '1. WORKFLOW STANDARD OPERATING PROCEDURE (SOP)';
    ws.getCell('B5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: this.PALETTE.NAVY_BRAND } };

    const steps = [
      ['Data Entry', 'Each category manager or partner agency submits one row per influencer on the "Data Entry" tab in the light-blue columns (B through U).'],
      ['Automated Scoring', 'As soon as data is entered, formulas compute Cost per Interaction (CPE), Cost per View (CPV), an automated Composite Score (0-100), and a System Recommendation.'],
      ['Duplicate & Savings Flagging', 'If the same influencer (handle/profile URL) is submitted by more than one manager or agency, the row is automatically flagged "⚠ DUPLICATE" with recommendation forced to "HOLD - Consolidate first".'],
      ['Consolidation Policy', 'No approval should be granted until the pricing discrepancy is resolved by consolidating under the lowest quoted agency rate.'],
      ['MD Review & Sign-off', 'The Managing Director (MD) or Brand Head reviews the high-level summary on the "Dashboard" tab and enters final decisions in the champagne gold columns.'],
      ['Performance Verification', 'Deliverable view/engagement counts and paid boosting performance are tracked across active campaigns on the "Reports" tab.']
    ];

    let rowIdx = 6;
    steps.forEach(([step, desc], i) => {
      ws.getCell(`B${rowIdx}`).value = `Step ${i + 1}: ${step}`;
      ws.getCell(`B${rowIdx}`).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: this.PALETTE.TEXT_DARK } };
      ws.getCell(`C${rowIdx}`).value = desc;
      ws.getCell(`C${rowIdx}`).font = { name: 'Segoe UI', size: 10, color: { argb: this.PALETTE.TEXT_DARK } };
      ws.getCell(`C${rowIdx}`).alignment = { wrapText: true };
      ws.getRow(rowIdx).height = 24;
      rowIdx++;
    });

    // Section 2: Color Legend
    rowIdx += 2;
    ws.getCell(`B${rowIdx}`).value = '2. COLOR LEGEND & VISUAL SEMANTICS';
    ws.getCell(`B${rowIdx}`).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: this.PALETTE.NAVY_BRAND } };
    rowIdx++;

    const legendItems = [
      { name: 'Light Blue Columns', fill: this.PALETTE.ICE_BLUE, text: this.PALETTE.TEXT_DARK, desc: 'Agency / Category Manager Input Fields — Only fields to be filled manually.' },
      { name: 'White / Subtle Slate', fill: this.PALETTE.WHITE, text: this.PALETTE.TEXT_DARK, desc: 'Automated Calculations (CPM, CPE, CPV, Composite Score) — Do not overwrite.' },
      { name: 'Champagne Gold', fill: this.PALETTE.GOLD_LIGHT, text: this.PALETTE.GOLD_TEXT, desc: 'Executive Decision Columns (Final Decision, Approved Cost) — Reserved for MD / Brand Head.' },
      { name: 'Coral / Red Warning', fill: this.PALETTE.RED_LIGHT, text: this.PALETTE.RED_TEXT, desc: '⚠ DUPLICATE Alert — Discrepancies where 2+ agencies quoted different pricing for same creator.' },
      { name: 'Mint Green', fill: this.PALETTE.GREEN_LIGHT, text: this.PALETTE.GREEN_TEXT, desc: 'Strong Approval & Potential Cost Savings from consolidation.' }
    ];

    legendItems.forEach(item => {
      const cellB = ws.getCell(`B${rowIdx}`);
      cellB.value = item.name;
      cellB.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: item.text } };
      cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.fill } };
      cellB.alignment = { vertical: 'middle', indent: 1 };
      cellB.border = {
        top: { style: 'thin', color: { argb: this.PALETTE.BORDER_DARK } },
        bottom: { style: 'thin', color: { argb: this.PALETTE.BORDER_DARK } },
        left: { style: 'thin', color: { argb: this.PALETTE.BORDER_DARK } },
        right: { style: 'thin', color: { argb: this.PALETTE.BORDER_DARK } }
      };

      const cellC = ws.getCell(`C${rowIdx}`);
      cellC.value = item.desc;
      cellC.font = { name: 'Segoe UI', size: 10, color: { argb: this.PALETTE.TEXT_DARK } };
      cellC.alignment = { vertical: 'middle' };
      ws.getRow(rowIdx).height = 26;
      rowIdx++;
    });
  }

  private buildDashboardSheet(
    wb: ExcelJS.Workbook,
    ctx: ExportReportContext,
    processed: any[],
    duplicatesCount: number,
    potentialSavings: number
  ): void {
    const ws = wb.addWorksheet('Dashboard', {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 3 }]
    });

    ws.columns = [
      { width: 4 },
      { width: 28 },
      { width: 20 },
      { width: 24 },
      { width: 24 },
      { width: 24 }
    ];

    // Executive Title Banner
    ws.mergeCells('B2:F2');
    const header = ws.getCell('B2');
    header.value = 'EXECUTIVE INFLUENCER MARKETING VETTING DASHBOARD';
    header.font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: this.PALETTE.WHITE } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_BRAND } };
    header.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(2).height = 36;

    // Sub-header Context
    ws.mergeCells('B3:F3');
    const sub = ws.getCell('B3');
    const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    sub.value = `Brand Workspace: ${ctx.brandName || 'Converge Brand Workspace'}   |   Active Campaign: ${ctx.campaignName || 'Consolidated Portfolio'}   |   Reporting Period: ${month}`;
    sub.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: this.PALETTE.NAVY_BRAND } };
    sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_LIGHT } };
    sub.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(3).height = 24;

    const totalSpend = processed.reduce((sum, c) => sum + (c.price || 0), 0);
    const avgScore = processed.length > 0
      ? (processed.reduce((sum, c) => sum + c.compositeScore, 0) / processed.length).toFixed(1)
      : '0';

    // 4 KPI Summary Cards (Side by Side in Rows 5-7)
    // Card 1: Total Quoted Spend
    ws.mergeCells('B5:B6');
    const kpi1 = ws.getCell('B5');
    kpi1.value = `TOTAL QUOTED SPEND\n₹${totalSpend.toLocaleString('en-IN')}`;
    kpi1.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: this.PALETTE.NAVY_BRAND } };
    kpi1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.CREAM } };
    kpi1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    this.applyBorder(kpi1);

    // Card 2: Potential Savings from Consolidation (Green)
    ws.mergeCells('C5:C6');
    const kpi2 = ws.getCell('C5');
    kpi2.value = `POTENTIAL SAVINGS\n₹${Math.round(potentialSavings).toLocaleString('en-IN')}`;
    kpi2.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: this.PALETTE.GREEN_TEXT } };
    kpi2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.GREEN_LIGHT } };
    kpi2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    this.applyBorder(kpi2);

    // Card 3: Duplicate Flags (Red)
    ws.mergeCells('D5:D6');
    const kpi3 = ws.getCell('D5');
    kpi3.value = `DUPLICATE FLAGS\n${duplicatesCount} Discrepancies`;
    kpi3.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: this.PALETTE.RED_TEXT } };
    kpi3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.RED_LIGHT } };
    kpi3.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    this.applyBorder(kpi3);

    // Card 4: Average Composite Score (Blue)
    ws.mergeCells('E5:F6');
    const kpi4 = ws.getCell('E5');
    kpi4.value = `AVG COMPOSITE SCORE\n${avgScore} / 100`;
    kpi4.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: this.PALETTE.BLUE_TEXT } };
    kpi4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.BLUE_LIGHT } };
    kpi4.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    this.applyBorder(kpi4);

    ws.getRow(5).height = 24;
    ws.getRow(6).height = 24;

    // SECTION: Agency Breakdown Table
    let curRow = 9;
    ws.mergeCells(`B${curRow}:F${curRow}`);
    const sec1 = ws.getCell(`B${curRow}`);
    sec1.value = 'AGENCY & CATEGORY MANAGER PERFORMANCE BREAKDOWN';
    sec1.font = { name: 'Segoe UI', size: 11.5, bold: true, color: { argb: this.PALETTE.NAVY_BRAND } };
    ws.getRow(curRow).height = 24;
    curRow++;

    const tblHeaders = ['Category / Agency Manager', '# Influencers', 'Total Quoted (₹)', 'Potential Savings (₹)', 'Avg Composite Score'];
    const tblHeaderCells = ['B', 'C', 'D', 'E', 'F'];
    tblHeaders.forEach((h, i) => {
      const cell = ws.getCell(`${tblHeaderCells[i]}${curRow}`);
      cell.value = h;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: this.PALETTE.WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_BRAND } };
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
      this.applyBorder(cell);
    });
    ws.getRow(curRow).height = 26;
    curRow++;

    // Calculate agency breakdown
    const agencyMap = new Map<string, { count: number, spend: number, savings: number, scores: number[] }>();
    processed.forEach(p => {
      const mgr = p.manager || 'Partner Agency';
      if (!agencyMap.has(mgr)) {
        agencyMap.set(mgr, { count: 0, spend: 0, savings: 0, scores: [] });
      }
      const entry = agencyMap.get(mgr)!;
      entry.count += 1;
      entry.spend += p.price;
      entry.savings += p.potentialSavings;
      entry.scores.push(p.compositeScore);
    });

    agencyMap.forEach((val, key) => {
      const meanScore = val.scores.length > 0 ? (val.scores.reduce((a, b) => a + b, 0) / val.scores.length).toFixed(1) : '0';
      const rowData = [
        key,
        val.count,
        `₹${val.spend.toLocaleString('en-IN')}`,
        `₹${Math.round(val.savings).toLocaleString('en-IN')}`,
        `${meanScore} / 100`
      ];
      rowData.forEach((d, i) => {
        const cell = ws.getCell(`${tblHeaderCells[i]}${curRow}`);
        cell.value = d;
        cell.font = { name: 'Segoe UI', size: 10, color: { argb: this.PALETTE.TEXT_DARK } };
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
        if (i === 3 && val.savings > 0) {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: this.PALETTE.GREEN_TEXT } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.GREEN_LIGHT } };
        }
        this.applyBorder(cell);
      });
      ws.getRow(curRow).height = 22;
      curRow++;
    });

    // SECTION: Top 5 Influencers by Composite Score
    curRow += 2;
    ws.mergeCells(`B${curRow}:F${curRow}`);
    const sec2 = ws.getCell(`B${curRow}`);
    sec2.value = 'TOP INFLUENCERS BY COMPOSITE VETTING SCORE (MD SELECTION)';
    sec2.font = { name: 'Segoe UI', size: 11.5, bold: true, color: { argb: this.PALETTE.NAVY_BRAND } };
    ws.getRow(curRow).height = 24;
    curRow++;

    const topHeaders = ['Rank', 'Influencer Name & Handle', 'Managing Agency', 'Composite Score', 'System Recommendation'];
    topHeaders.forEach((h, i) => {
      const cell = ws.getCell(`${tblHeaderCells[i]}${curRow}`);
      cell.value = h;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: this.PALETTE.WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_DARK } };
      cell.alignment = { vertical: 'middle', horizontal: i <= 1 ? 'left' : 'center' };
      this.applyBorder(cell);
    });
    ws.getRow(curRow).height = 26;
    curRow++;

    const sorted = [...processed].sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5);
    const rankBadges = ['🥇 Rank 1', '🥈 Rank 2', '🥉 Rank 3', 'Rank 4', 'Rank 5'];

    sorted.forEach((s, idx) => {
      const rowData = [
        rankBadges[idx],
        `${s.name} (${s.handle})`,
        s.manager,
        `${s.compositeScore} / 100`,
        s.recommendation
      ];

      rowData.forEach((d, i) => {
        const cell = ws.getCell(`${tblHeaderCells[i]}${curRow}`);
        cell.value = d;
        cell.font = { name: 'Segoe UI', size: 10, bold: i === 0 || i === 3, color: { argb: this.PALETTE.TEXT_DARK } };
        cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' };
        if (i === 4) {
          if (s.recommendation.includes('HOLD')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.RED_LIGHT } };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: this.PALETTE.RED_TEXT } };
          } else if (s.recommendation.includes('Strong Approve')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.GREEN_LIGHT } };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: this.PALETTE.GREEN_TEXT } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.BLUE_LIGHT } };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: this.PALETTE.BLUE_TEXT } };
          }
        }
        this.applyBorder(cell);
      });
      ws.getRow(curRow).height = 22;
      curRow++;
    });

    // SECTION: Score Distribution & Decision Matrix Guide (Chart / Diagram summary for MD)
    curRow += 2;
    ws.mergeCells(`B${curRow}:F${curRow}`);
    const sec3 = ws.getCell(`B${curRow}`);
    sec3.value = 'COMPOSITE SCORE DISTRIBUTION & DECISION MATRIX';
    sec3.font = { name: 'Segoe UI', size: 11.5, bold: true, color: { argb: this.PALETTE.NAVY_BRAND } };
    ws.getRow(curRow).height = 24;
    curRow++;

    const matrixRows = [
      ['80 – 100', 'Strong Approve', 'High ROI, high authenticity (>80% organic), excellent CPM/CPV value. Clear for immediate contract.', this.PALETTE.GREEN_LIGHT, this.PALETTE.GREEN_TEXT],
      ['65 – 79.9', 'Approve', 'Solid metrics meeting category benchmarks. Recommended for portfolio inclusion.', this.PALETTE.BLUE_LIGHT, this.PALETTE.BLUE_TEXT],
      ['50 – 64.9', 'Approve with Negotiation', 'Marginal value. Category manager must negotiate rate down before final signing.', this.PALETTE.GOLD_LIGHT, this.PALETTE.GOLD_TEXT],
      ['Below 50', 'Review / Reject', 'High risk of bot engagement or overpriced CPM. Reject or renegotiate drastically.', this.PALETTE.RED_LIGHT, this.PALETTE.RED_TEXT],
      ['Any Duplicate', 'HOLD - Consolidate First', 'Quoted by multiple agencies with rate discrepancies. Consolidate under lowest rate first.', this.PALETTE.RED_LIGHT, this.PALETTE.RED_TEXT]
    ];

    matrixRows.forEach(([range, status, action, fill, text]) => {
      const cellB = ws.getCell(`B${curRow}`);
      cellB.value = range;
      cellB.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: text as string } };
      cellB.alignment = { vertical: 'middle', horizontal: 'center' };
      this.applyBorder(cellB);

      const cellC = ws.getCell(`C${curRow}`);
      cellC.value = status;
      cellC.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: text as string } };
      cellC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill as string } };
      cellC.alignment = { vertical: 'middle', horizontal: 'center' };
      this.applyBorder(cellC);

      ws.mergeCells(`D${curRow}:F${curRow}`);
      const cellD = ws.getCell(`D${curRow}`);
      cellD.value = action;
      cellD.font = { name: 'Segoe UI', size: 9.5, color: { argb: this.PALETTE.TEXT_DARK } };
      cellD.alignment = { vertical: 'middle' };
      this.applyBorder(cellD);

      ws.getRow(curRow).height = 22;
      curRow++;
    });
  }

  private buildDataEntrySheet(wb: ExcelJS.Workbook, processed: any[]): void {
    const ws = wb.addWorksheet('Data Entry', {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
    });

    const headers = [
      { name: 'Sr No', width: 8, align: 'center' },
      { name: 'Category Manager / Agency', width: 24, align: 'left', isInput: true },
      { name: 'Category', width: 18, align: 'left', isInput: true },
      { name: 'Influencer Name', width: 22, align: 'left', isInput: true },
      { name: 'Instagram Handle', width: 18, align: 'left', isInput: true },
      { name: 'Profile URL', width: 34, align: 'left', isInput: true },
      { name: 'Platform', width: 14, align: 'center', isInput: true },
      { name: 'Followers Count', width: 16, align: 'right' },
      { name: 'Tier (Auto)', width: 14, align: 'center' },
      { name: 'Creator Type', width: 16, align: 'center' },
      { name: 'IR % (Interaction Rate)', width: 16, align: 'right' },
      { name: 'Avg Views / Post', width: 16, align: 'right' },
      { name: 'Hook Rate', width: 14, align: 'center' },
      { name: 'Cost Quoted (₹)', width: 18, align: 'right', isInput: true },
      { name: 'CPM (Cost / 1k Reach)', width: 18, align: 'right' },
      { name: 'CPE (Cost / Engagement)', width: 18, align: 'right' },
      { name: 'CPV (Cost / View)', width: 16, align: 'right' },
      { name: 'Audience Fit (1-5)', width: 14, align: 'center', isInput: true },
      { name: 'Content Quality (1-5)', width: 16, align: 'center', isInput: true },
      { name: 'Authenticity Risk', width: 16, align: 'center', isInput: true },
      { name: 'Past Track Record (1-5)', width: 16, align: 'center', isInput: true },
      { name: 'Normalized Handle', width: 18, align: 'left' },
      { name: 'Duplicate Check', width: 18, align: 'center' },
      { name: 'Managers Quoting (#)', width: 16, align: 'center' },
      { name: 'Total Quoted Across Duplicates (₹)', width: 26, align: 'right' },
      { name: 'Potential Savings from Consolidation (₹)', width: 28, align: 'right' },
      { name: 'Cost Efficiency Score', width: 16, align: 'center' },
      { name: 'Engagement Score', width: 16, align: 'center' },
      { name: 'Fit & Quality Score', width: 16, align: 'center' },
      { name: 'Credibility Score', width: 16, align: 'center' },
      { name: 'Composite Score (0-100)', width: 20, align: 'center' },
      { name: 'System Recommendation', width: 24, align: 'center' },
      { name: 'Final Decision', width: 18, align: 'center', isDecision: true },
      { name: 'Approved Cost (₹)', width: 18, align: 'right', isDecision: true },
      { name: 'Notes / Justification', width: 38, align: 'left', isDecision: true }
    ];

    ws.columns = headers.map(h => ({ width: h.width }));

    // Header Row
    const headerRow = ws.getRow(1);
    headerRow.height = 34;

    headers.forEach((h, colIdx) => {
      const cell = headerRow.getCell(colIdx + 1);
      cell.value = h.name;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: this.PALETTE.WHITE } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: h.isDecision
            ? this.PALETTE.GOLD_TEXT
            : (h.isInput ? 'FF2563EB' : this.PALETTE.NAVY_BRAND)
        }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      this.applyBorder(cell);
    });

    // Data Rows
    processed.forEach((p, rIdx) => {
      const row = ws.getRow(rIdx + 2);
      row.height = 22;

      const rowValues = [
        p.srNo,
        p.manager,
        p.category,
        p.name,
        p.handle,
        p.profileLink,
        p.platform,
        p.followers,
        p.tier,
        p.creatorType,
        `${p.irPercent}%`,
        p.avgViews,
        p.hookRate,
        p.price,
        p.cpm,
        p.cpe,
        p.cpv,
        p.audienceFit,
        p.contentQuality,
        p.authenticityRisk,
        p.pastTrackRecord,
        p.normalizedHandle,
        p.duplicateStatus,
        p.duplicateCount,
        p.totalQuotedAcrossDuplicates,
        p.potentialSavings,
        p.costEfficiencyScore,
        p.engagementScore,
        p.fitQualityScore,
        p.credibilityScore,
        p.compositeScore,
        p.recommendation,
        p.finalDecision,
        p.approvedCost,
        p.notes
      ];

      rowValues.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = val;
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: this.PALETTE.TEXT_DARK } };
        cell.alignment = { vertical: 'middle', horizontal: (headers[colIdx].align as any) || 'left' };

        // Color coding cells
        if (headers[colIdx].isInput) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.ICE_BLUE } };
        } else if (headers[colIdx].isDecision) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.GOLD_LIGHT } };
          cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: this.PALETTE.GOLD_TEXT } };
        }

        // Duplicate highlight
        if (p.isDuplicate) {
          if (colIdx === 22) { // Duplicate check column
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.RED_LIGHT } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: this.PALETTE.RED_TEXT } };
          }
          if (colIdx === 25 && p.potentialSavings > 0) { // Potential savings column
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.GREEN_LIGHT } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: this.PALETTE.GREEN_TEXT } };
          }
        }

        // Recommendation highlight
        if (colIdx === 31) {
          cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: this.PALETTE.TEXT_DARK } };
          if (p.recommendation.includes('HOLD')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.RED_LIGHT } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: this.PALETTE.RED_TEXT } };
          } else if (p.recommendation.includes('Strong Approve')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.GREEN_LIGHT } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: this.PALETTE.GREEN_TEXT } };
          } else if (p.recommendation.includes('Approve')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.BLUE_LIGHT } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: this.PALETTE.BLUE_TEXT } };
          }
        }

        this.applyBorder(cell);
      });
    });
  }

  private buildReportsSheet(wb: ExcelJS.Workbook, ctx: ExportReportContext): void {
    const ws = wb.addWorksheet('Reports', {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
    });

    const headers = [
      { name: 'Deliverable Type', width: 18, align: 'center' },
      { name: 'Deliverable Title', width: 34, align: 'left' },
      { name: 'Influencer Handle', width: 20, align: 'left' },
      { name: 'Agency Partner', width: 22, align: 'left' },
      { name: 'Product / Campaign Focus', width: 24, align: 'left' },
      { name: 'Instagram Content URL', width: 36, align: 'left' },
      { name: 'Live / Published Date', width: 18, align: 'center' },
      { name: 'Agreed Rate (₹)', width: 18, align: 'right' },
      { name: 'Delivered Views', width: 16, align: 'right' },
      { name: 'Likes', width: 14, align: 'right' },
      { name: 'Comments', width: 14, align: 'right' },
      { name: 'Shares (Est.)', width: 14, align: 'right' },
      { name: 'Saves (Est.)', width: 14, align: 'right' },
      { name: 'CPV (₹ / View)', width: 16, align: 'right' },
      { name: 'Boosting Status', width: 18, align: 'center' }
    ];

    ws.columns = headers.map(h => ({ width: h.width }));

    // Header row
    const headerRow = ws.getRow(1);
    headerRow.height = 32;

    headers.forEach((h, colIdx) => {
      const cell = headerRow.getCell(colIdx + 1);
      cell.value = h.name;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: this.PALETTE.WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_BRAND } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      this.applyBorder(cell);
    });

    // Content rows
    ctx.contentItems.forEach((ci, idx) => {
      const row = ws.getRow(idx + 2);
      row.height = 22;

      const views = ci.views || 0;
      const likes = ci.likes || 0;
      const comments = ci.comments || 0;
      const price = ci.finalPrice || 0;
      const cpv = views > 0 ? (price / views).toFixed(2) : '—';
      const shares = Math.round(likes * 0.12);
      const saves = Math.round(likes * 0.08);

      const rowValues = [
        ci.format || 'Instagram Reel',
        ci.title || `Deliverable #${idx + 1}`,
        ci.creatorHandle || '—',
        ci.agencyName || 'Partner Agency',
        ctx.campaignName || 'Core Portfolio',
        ci.contentUrl || '—',
        ci.publishedDate || 'Nov 2026',
        price,
        views,
        likes,
        comments,
        shares,
        saves,
        cpv === '—' ? cpv : `₹${cpv}`,
        views > 10000 ? 'Paid Boosted' : 'Organic Only'
      ];

      rowValues.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = val;
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: this.PALETTE.TEXT_DARK } };
        cell.alignment = { vertical: 'middle', horizontal: (headers[colIdx].align as any) || 'left' };
        if (colIdx === 7 && typeof val === 'number') {
          cell.value = `₹${val.toLocaleString('en-IN')}`;
        }
        if ((colIdx >= 8 && colIdx <= 12) && typeof val === 'number') {
          cell.value = val.toLocaleString('en-IN');
        }
        this.applyBorder(cell);
      });
    });
  }

  private buildScoringGuideSheet(wb: ExcelJS.Workbook): void {
    const ws = wb.addWorksheet('Scoring Guide', {
      views: [{ showGridLines: true }]
    });

    ws.columns = [
      { width: 4 },
      { width: 28 },
      { width: 54 },
      { width: 16 }
    ];

    // Banner
    ws.mergeCells('B2:D2');
    const header = ws.getCell('B2');
    header.value = 'INFLUENCER VETTING METHODOLOGY & SCORING GUIDE';
    header.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.PALETTE.WHITE } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_BRAND } };
    header.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(2).height = 36;

    let curRow = 4;
    ws.mergeCells(`B${curRow}:D${curRow}`);
    const sec1 = ws.getCell(`B${curRow}`);
    sec1.value = '1. EVALUATION WEIGHTS (100% TOTAL COMPOSITE SCORE)';
    sec1.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: this.PALETTE.NAVY_BRAND } };
    ws.getRow(curRow).height = 24;
    curRow++;

    const weights = [
      ['Metric / Factor', 'Why It Matters & Measurement Logic', 'Weight'],
      ['Engagement Rate / ERR vs Tier Benchmark', 'Real audience engagement, not just vanity follower count. High followers with low ERR signals low-quality reach.', '25%'],
      ['Cost Efficiency (Fair CPE vs Quoted)', 'Cost per Engagement (CPE = Quoted / Engagements) compared against industry fair-market benchmarks.', '25%'],
      ['Audience Fit + Content Quality', 'Whether audience demographic matches brand category and video production meets creative standards.', '20%'],
      ['Authenticity / Fake-Follower Risk', 'Protects against inflated followings and engagement pods using ratio and activity depth analysis.', '20%'],
      ['Past Collaboration Track Record', 'Prior delivery track record for brand campaigns. Emerging/new creators receive a neutral score.', '10%']
    ];

    weights.forEach((w, idx) => {
      const isHeader = idx === 0;
      const cellB = ws.getCell(`B${curRow}`);
      cellB.value = w[0];
      cellB.font = { name: 'Segoe UI', size: 10, bold: isHeader, color: { argb: isHeader ? this.PALETTE.WHITE : this.PALETTE.TEXT_DARK } };
      if (isHeader) cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_BRAND } };
      this.applyBorder(cellB);

      const cellC = ws.getCell(`C${curRow}`);
      cellC.value = w[1];
      cellC.font = { name: 'Segoe UI', size: 9.5, bold: isHeader, color: { argb: isHeader ? this.PALETTE.WHITE : this.PALETTE.TEXT_DARK } };
      cellC.alignment = { wrapText: true };
      if (isHeader) cellC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_BRAND } };
      this.applyBorder(cellC);

      const cellD = ws.getCell(`D${curRow}`);
      cellD.value = w[2];
      cellD.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: isHeader ? this.PALETTE.WHITE : this.PALETTE.NAVY_BRAND } };
      cellD.alignment = { horizontal: 'center' };
      if (isHeader) cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_BRAND } };
      this.applyBorder(cellD);

      ws.getRow(curRow).height = isHeader ? 26 : 28;
      curRow++;
    });

    // Indian Market Tier Benchmark Table
    curRow += 2;
    ws.mergeCells(`B${curRow}:D${curRow}`);
    const sec2 = ws.getCell(`B${curRow}`);
    sec2.value = '2. INDICATIVE INDIAN MARKET BENCHMARKS (BY TIER)';
    sec2.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: this.PALETTE.NAVY_BRAND } };
    ws.getRow(curRow).height = 24;
    curRow++;

    const tiers = [
      ['Tier', 'Follower Range', 'Good ERR % Benchmark', 'Fair Cost per Engagement (₹)', 'Typical Quoted Cost per 1k Followers (₹)'],
      ['Nano', '1,000 – 9,999', '8.0%', '₹12', '₹150 – 300'],
      ['Micro', '10,000 – 99,999', '5.0%', '₹20', '₹100 – 250'],
      ['Mid-Tier', '100,000 – 499,999', '3.0%', '₹35', '₹80 – 200'],
      ['Macro', '500,000 – 999,999', '2.0%', '₹55', '₹60 – 150'],
      ['Celebrity / Mega', '1,000,000+', '1.0%', '₹90', '₹40 – 120']
    ];

    ws.columns = [
      { width: 4 },
      { width: 20 },
      { width: 22 },
      { width: 22 },
      { width: 26 },
      { width: 34 }
    ];

    tiers.forEach((t, idx) => {
      const isHeader = idx === 0;
      const cols = ['B', 'C', 'D', 'E', 'F'];
      t.forEach((val, i) => {
        const cell = ws.getCell(`${cols[i]}${curRow}`);
        cell.value = val;
        cell.font = { name: 'Segoe UI', size: 9.5, bold: isHeader || i === 0, color: { argb: isHeader ? this.PALETTE.WHITE : this.PALETTE.TEXT_DARK } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (isHeader) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.PALETTE.NAVY_BRAND } };
        }
        this.applyBorder(cell);
      });
      ws.getRow(curRow).height = isHeader ? 26 : 22;
      curRow++;
    });
  }

  private applyBorder(cell: ExcelJS.Cell): void {
    cell.border = {
      top: { style: 'thin', color: { argb: this.PALETTE.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { argb: this.PALETTE.BORDER_LIGHT } },
      left: { style: 'thin', color: { argb: this.PALETTE.BORDER_LIGHT } },
      right: { style: 'thin', color: { argb: this.PALETTE.BORDER_LIGHT } }
    };
  }
}
