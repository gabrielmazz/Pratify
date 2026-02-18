import { useEffect, useMemo, useRef, useState } from 'react'
import { BlobProvider, Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerSrc

type MealPlanPdfMealItem = {
	id: string
	foodId: string | null
	food: string
	quantity: string
	measure: string
	notes: string
}

export type MealPlanPdfMealGroup = {
	id: string
	name: string
	items: MealPlanPdfMealItem[]
}

export type MealPlanPdfRecipeSuggestion = {
	id: string
	recipeName: string
	basedOnFoods: string
	ingredients: string
	preparationMethod: string
	yieldInfo: string
	portionQuantity: string
}

export type MealPlanPdfPatient = {
	id: number
	name: string
	birthDate: string
	gender: string
	weight: number
	height: number
	bmi: number
	goal: string
	activityLevel: string
	medicalConditions: string[]
	armCircumference: number
	waistCircumference: number
	hipCircumference: number
	thighCircumference: number
	subscapularSkinfold: number
	axillarySkinfold: number
	suprailiacSkinfold: number
	abdominalSkinfold: number
	bmr: number
	tdee: number
	createdAt: string
}

export type MealPlanPdfPortionSummaryRow = {
	groupName: string
	portions: number
}

export type MealPlanPdfMicronutrientSummaryRow = {
	nutrientLabel: string
	offeredLabel: string
	earLabel: string
	rdaOrAiLabel: string
	ulLabel: string
	analysis: string
}

export type MealPlanPdfMacronutrientSummaryRow = {
	nutrientLabel: string
	offeredLabel: string
	recommendedLabel: string
	analysis: string
}

export type MealPlanPdfMealDistributionRow = {
	scheduleLabel: string
	mealLabel: string
	proteinG: number
	carbohydrateG: number
	lipidG: number
	caloriesKcal: number
	quantityG: number
}

export type MealPlanPdfInfographicRow = {
	nutrientLabel: string
	value: number
	unit: string
	referenceValue: number | null
	referenceLabel: string
	referenceKind: 'minimum' | 'maximum' | 'none'
	barPercentage: number
	isPositive: boolean
}

export type MealPlanPdfNutritionPreviewData = {
	portionRows: MealPlanPdfPortionSummaryRow[]
	totalPlanKcal: number
	totalProteinG: number
	totalCarbohydrateG: number
	totalLipidG: number
	totalQuantityG: number
	totalMappedFoodsCount: number
	estimatedItemsCount: number
	micronutrientRows: MealPlanPdfMicronutrientSummaryRow[]
	macronutrientRows: MealPlanPdfMacronutrientSummaryRow[]
	mealDistributionRows: MealPlanPdfMealDistributionRow[]
	infographicRows: MealPlanPdfInfographicRow[]
}

type MealPlanPdfCanvasPreviewProps = {
	patient: MealPlanPdfPatient
	mealGroups: MealPlanPdfMealGroup[]
	orientationTips?: string[]
	nutritionPreview?: MealPlanPdfNutritionPreviewData | null
	recipeSuggestions?: MealPlanPdfRecipeSuggestion[]
}

type MealTableRow = {
	groupName: string
	schedule: string
	food: string
	amount: string
	notes: string
	isGroupStart: boolean
}

type PdfCanvasRendererProps = {
	pdfUrl: string | null
	isGeneratingBlob: boolean
	generationErrorMessage: string | null
	downloadFileName: string
}

const GOAL_LABELS: Record<string, string> = {
	'weight-loss': 'Emagrecimento',
	'muscle-gain': 'Ganho muscular',
	'dietary-reeducation': 'Reeducacao alimentar',
	'weight-maintenance': 'Manutencao de peso',
	'sports-performance': 'Performance esportiva',
	'metabolic-health': 'Saude metabolica',
	'intestinal-health': 'Saude intestinal',
}

const ACTIVITY_LEVEL_LABELS: Record<string, string> = {
	sedentary: 'Sedentario',
	light: 'Leve',
	moderate: 'Moderado',
	intense: 'Intenso',
	'very-intense': 'Muito intenso',
}

const MEDICAL_CONDITION_LABELS: Record<string, string> = {
	diabetes: 'Diabetes',
	hypertension: 'Hipertensao',
	dyslipidemia: 'Dislipidemia',
	'heart-disease': 'Doenca cardiaca',
	'kidney-disease': 'Doenca renal',
	'liver-disease': 'Doenca hepatica',
	'thyroid-disorder': 'Disturbio de tireoide',
	'food-allergy-intolerance': 'Alergias/intolerancias alimentares',
}

const pdfStyles = StyleSheet.create({
	reportPage: {
		paddingTop: 26,
		paddingHorizontal: 30,
		paddingBottom: 30,
		fontFamily: 'Helvetica',
		fontSize: 10.2,
		color: '#0f172a',
	},
	reportHeaderCard: {
		borderWidth: 1,
		borderColor: '#aad1e4',
		backgroundColor: '#dceff9',
		borderRadius: 10,
		paddingVertical: 12,
		paddingHorizontal: 14,
		marginBottom: 10,
	},
	reportTitle: {
		fontFamily: 'Helvetica-Bold',
		fontSize: 18,
		textAlign: 'center',
		letterSpacing: 0.8,
		color: '#075985',
	},
	reportSubtitle: {
		fontSize: 10.4,
		textAlign: 'center',
		marginTop: 4,
		color: '#0f172a',
	},
	reportSectionTitle: {
		fontFamily: 'Helvetica-Bold',
		fontSize: 10.6,
		textTransform: 'uppercase',
		letterSpacing: 0.8,
		color: '#155e75',
		marginBottom: 6,
	},
	reportSectionBlock: {
		borderWidth: 1,
		borderColor: '#c6dfeb',
		backgroundColor: '#fbfdff',
		borderRadius: 8,
		paddingVertical: 8,
		paddingHorizontal: 10,
		marginBottom: 8,
	},
	reportLine: {
		fontFamily: 'Helvetica',
		fontSize: 10.2,
		lineHeight: 1.3,
		marginBottom: 2,
		color: '#0f172a',
	},
	reportLineSpaced: {
		fontFamily: 'Helvetica',
		fontSize: 10.2,
		lineHeight: 1.4,
		marginBottom: 7,
		color: '#0f172a',
	},
	reportClassRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 2,
	},
	reportClassLeft: {
		width: '57%',
		fontFamily: 'Helvetica',
		fontSize: 10.2,
		lineHeight: 1.3,
		color: '#0f172a',
	},
	reportClassRight: {
		width: '43%',
		fontFamily: 'Helvetica',
		fontSize: 10.2,
		lineHeight: 1.3,
		textAlign: 'left',
		paddingLeft: 6,
		color: '#334155',
	},
	reportInlineBold: {
		fontFamily: 'Helvetica-Bold',
		fontSize: 10.2,
		color: '#0f172a',
	},
	reportInlineRegular: {
		fontFamily: 'Helvetica',
		fontSize: 10.2,
		color: '#0f172a',
	},
	reportInfoChipContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 4,
	},
	reportInfoChip: {
		borderWidth: 1,
		borderColor: '#b9ddee',
		backgroundColor: '#edf7fc',
		borderRadius: 4,
		paddingHorizontal: 6,
		paddingVertical: 3,
		marginRight: 5,
		marginBottom: 5,
		fontSize: 9,
		color: '#155e75',
	},
	page: {
		paddingTop: 24,
		paddingHorizontal: 26,
		paddingBottom: 28,
		fontFamily: 'Helvetica',
		fontSize: 10,
		color: '#0f172a',
	},
	headerCard: {
		borderWidth: 1,
		borderColor: '#b9ddee',
		backgroundColor: '#e9f5fb',
		borderRadius: 10,
		paddingVertical: 12,
		paddingHorizontal: 14,
		marginBottom: 12,
	},
	headerTitle: {
		fontSize: 16,
		fontWeight: 700,
		textAlign: 'center',
		letterSpacing: 1,
		color: '#075985',
	},
	headerSubtitle: {
		fontSize: 9.5,
		textAlign: 'center',
		marginTop: 4,
		color: '#0f172a',
	},
	section: {
		borderWidth: 1,
		borderColor: '#d6e3eb',
		backgroundColor: '#ffffff',
		borderRadius: 8,
		padding: 10,
		marginBottom: 9,
	},
	orientationSection: {
		marginTop: 10,
	},
	sectionTitle: {
		fontSize: 10.2,
		fontWeight: 700,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
		color: '#155e75',
		marginBottom: 6,
	},
	keyValueRow: {
		flexDirection: 'row',
		marginBottom: 3,
	},
	keyLabel: {
		width: 168,
		fontWeight: 700,
		color: '#334155',
	},
	keyValue: {
		flexGrow: 1,
		color: '#0f172a',
	},
	condutaText: {
		fontSize: 9.5,
		lineHeight: 1.35,
		marginBottom: 4,
		color: '#1e293b',
	},
	infoChipContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 2,
	},
	infoChip: {
		borderWidth: 1,
		borderColor: '#b5d8e8',
		backgroundColor: '#f2f9fc',
		borderRadius: 4,
		paddingHorizontal: 6,
		paddingVertical: 4,
		marginRight: 6,
		marginBottom: 6,
		fontSize: 8.8,
	},
	tableContainer: {
		borderWidth: 1.2,
		borderColor: '#96c4db',
		borderRadius: 8,
		overflow: 'hidden',
	},
	tableHeaderRow: {
		flexDirection: 'row',
		backgroundColor: '#d4ebf8',
		borderBottomWidth: 1.2,
		borderBottomColor: '#96c4db',
	},
	tableHeaderCell: {
		paddingHorizontal: 7,
		paddingVertical: 7,
		fontSize: 8.6,
		fontWeight: 700,
		color: '#0c4a6e',
		textTransform: 'uppercase',
		borderRightWidth: 1,
		borderRightColor: '#b6d6e7',
	},
	tableHeaderCellLast: {
		borderRightWidth: 0,
	},
	tableRow: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#c9dfea',
	},
	tableRowEven: {
		backgroundColor: '#ffffff',
	},
	tableRowOdd: {
		backgroundColor: '#f8fcff',
	},
	tableRowGroupDivider: {
		borderTopWidth: 1,
		borderTopColor: '#9fc8dd',
	},
	tableRowStart: {
		backgroundColor: '#eaf5fc',
	},
	tableCell: {
		paddingHorizontal: 7,
		paddingVertical: 5.5,
		fontSize: 9,
		lineHeight: 1.25,
		color: '#0f172a',
		borderRightWidth: 1,
		borderRightColor: '#d8e8f1',
	},
	tableCellStrong: {
		fontFamily: 'Helvetica-Bold',
		color: '#0b4f77',
	},
	tableCellLast: {
		borderRightWidth: 0,
	},
	tableCellMuted: {
		color: '#7b93a5',
	},
	groupCol: {
		width: 104,
	},
	scheduleCol: {
		width: 62,
	},
	foodCol: {
		width: 160,
	},
	amountCol: {
		width: 96,
	},
	notesCol: {
		flexGrow: 1,
	},
	listRow: {
		flexDirection: 'row',
		marginBottom: 4,
	},
	listBullet: {
		width: 9,
		fontWeight: 700,
	},
	listText: {
		flexGrow: 1,
		fontSize: 9.3,
		lineHeight: 1.35,
	},
	footerText: {
		marginTop: 10,
		fontSize: 8.7,
		color: '#64748b',
		textAlign: 'center',
	},
	adequacyIntroText: {
		fontSize: 8.9,
		color: '#334155',
		marginBottom: 8,
	},
	adequacyTableContainer: {
		borderWidth: 1.2,
		borderColor: '#96c4db',
		borderRadius: 8,
		overflow: 'hidden',
		marginBottom: 10,
	},
	adequacyTableTitleRow: {
		backgroundColor: '#eaf5fc',
		borderBottomWidth: 1.2,
		borderBottomColor: '#96c4db',
		paddingVertical: 5,
		paddingHorizontal: 7,
	},
	adequacyTableTitleText: {
		fontSize: 9,
		fontFamily: 'Helvetica-Bold',
		textTransform: 'uppercase',
		textAlign: 'center',
		color: '#0b4f77',
		letterSpacing: 0.4,
	},
	adequacyHeaderRow: {
		flexDirection: 'row',
		backgroundColor: '#d4ebf8',
		borderBottomWidth: 1.2,
		borderBottomColor: '#96c4db',
	},
	adequacyHeaderCell: {
		paddingVertical: 4.5,
		paddingHorizontal: 6,
		fontSize: 8.2,
		fontFamily: 'Helvetica-Bold',
		color: '#0c4a6e',
		textTransform: 'uppercase',
		borderRightWidth: 1,
		borderRightColor: '#b6d6e7',
	},
	adequacyHeaderCellLast: {
		borderRightWidth: 0,
	},
	adequacySectionRow: {
		paddingVertical: 4,
		paddingHorizontal: 6,
		backgroundColor: '#eaf5fc',
		borderBottomWidth: 1,
		borderBottomColor: '#9fc8dd',
	},
	adequacySectionText: {
		fontSize: 8.3,
		fontFamily: 'Helvetica-Bold',
		color: '#0b4f77',
		textAlign: 'center',
		textTransform: 'uppercase',
	},
	adequacyRow: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#c9dfea',
	},
	adequacyRowEven: {
		backgroundColor: '#ffffff',
	},
	adequacyRowOdd: {
		backgroundColor: '#f8fcff',
	},
	adequacyCell: {
		paddingVertical: 4,
		paddingHorizontal: 6,
		fontSize: 8.1,
		color: '#0f172a',
		borderRightWidth: 1,
		borderRightColor: '#d8e8f1',
	},
	adequacyCellCenter: {
		textAlign: 'center',
	},
	adequacyCellStrong: {
		fontFamily: 'Helvetica-Bold',
		color: '#0b4f77',
	},
	adequacyCellLast: {
		borderRightWidth: 0,
	},
	adequacyGroupCol: {
		width: 370,
	},
	adequacyPortionCol: {
		flexGrow: 1,
	},
	adequacyNutrientCol: {
		width: 125,
	},
	adequacyOfferedCol: {
		width: 90,
	},
	adequacyEarCol: {
		width: 54,
	},
	adequacyRdaCol: {
		width: 62,
	},
	adequacyUlCol: {
		width: 48,
	},
	adequacyAnalysisCol: {
		flexGrow: 1,
	},
	adequacyRecommendedCol: {
		width: 164,
	},
	distributionIntroText: {
		fontSize: 8.9,
		color: '#334155',
		marginBottom: 8,
	},
	distributionChartCard: {
		borderWidth: 1.2,
		borderColor: '#96c4db',
		borderRadius: 8,
		backgroundColor: '#ffffff',
		paddingVertical: 8,
		paddingHorizontal: 8,
		marginBottom: 10,
	},
	distributionChartLegendRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		marginBottom: 6,
	},
	distributionChartLegendItem: {
		flexDirection: 'row',
		alignItems: 'center',
		marginHorizontal: 6,
	},
	distributionChartLegendSwatch: {
		width: 9,
		height: 9,
		borderRadius: 2,
		marginRight: 4,
	},
	distributionLegendProtein: {
		backgroundColor: '#ef4444',
	},
	distributionLegendCarbohydrate: {
		backgroundColor: '#7c3aed',
	},
	distributionLegendLipid: {
		backgroundColor: '#f59e0b',
	},
	distributionChartLegendLabel: {
		fontSize: 7.5,
		color: '#475569',
	},
	distributionChartAreaRow: {
		flexDirection: 'row',
		alignItems: 'stretch',
	},
	distributionChartAxis: {
		width: 33,
		paddingTop: 3,
		paddingBottom: 22,
		paddingRight: 3,
		justifyContent: 'space-between',
		alignItems: 'flex-end',
	},
	distributionChartAxisLabel: {
		fontSize: 7,
		color: '#64748b',
	},
	distributionChartPlot: {
		flexGrow: 1,
		height: 156,
		borderWidth: 1,
		borderColor: '#c9dfea',
		borderRadius: 6,
		paddingTop: 4,
		paddingBottom: 24,
		paddingHorizontal: 7,
		position: 'relative',
	},
	distributionChartGrid: {
		position: 'absolute',
		top: 4,
		left: 7,
		right: 7,
		bottom: 24,
		justifyContent: 'space-between',
	},
	distributionChartGridLine: {
		borderTopWidth: 1,
		borderTopColor: '#d8e8f1',
	},
	distributionChartBarsRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-end',
		flexGrow: 1,
	},
	distributionChartGroup: {
		width: 58,
		alignItems: 'center',
	},
	distributionChartBarsStack: {
		height: 114,
		flexDirection: 'row',
		alignItems: 'flex-end',
		justifyContent: 'center',
	},
	distributionChartBar: {
		width: 10,
		borderTopLeftRadius: 2,
		borderTopRightRadius: 2,
		marginHorizontal: 1,
	},
	distributionChartBarProtein: {
		backgroundColor: '#ef4444',
	},
	distributionChartBarCarbohydrate: {
		backgroundColor: '#7c3aed',
	},
	distributionChartBarLipid: {
		backgroundColor: '#f59e0b',
	},
	distributionChartGroupLabel: {
		fontSize: 7.1,
		color: '#334155',
		textAlign: 'center',
		marginTop: 3,
	},
	distributionTableContainer: {
		borderWidth: 1.2,
		borderColor: '#96c4db',
		borderRadius: 8,
		overflow: 'hidden',
		marginBottom: 8,
	},
	distributionTableTitleRow: {
		backgroundColor: '#eaf5fc',
		borderBottomWidth: 1.2,
		borderBottomColor: '#96c4db',
		paddingVertical: 5,
		paddingHorizontal: 7,
	},
	distributionTableTitleText: {
		fontSize: 9,
		fontFamily: 'Helvetica-Bold',
		textTransform: 'uppercase',
		textAlign: 'left',
		color: '#0b4f77',
	},
	distributionHeaderRow: {
		flexDirection: 'row',
		backgroundColor: '#d4ebf8',
		borderBottomWidth: 1.2,
		borderBottomColor: '#96c4db',
	},
	distributionHeaderCell: {
		paddingVertical: 4.2,
		paddingHorizontal: 6,
		fontSize: 7.9,
		fontFamily: 'Helvetica-Bold',
		color: '#0c4a6e',
		textTransform: 'uppercase',
		borderRightWidth: 1,
		borderRightColor: '#b6d6e7',
	},
	distributionHeaderCellLast: {
		borderRightWidth: 0,
	},
	distributionRow: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#c9dfea',
	},
	distributionRowEven: {
		backgroundColor: '#ffffff',
	},
	distributionRowOdd: {
		backgroundColor: '#f8fcff',
	},
	distributionCell: {
		paddingVertical: 4,
		paddingHorizontal: 6,
		fontSize: 7.9,
		color: '#0f172a',
		borderRightWidth: 1,
		borderRightColor: '#d8e8f1',
	},
	distributionCellCenter: {
		textAlign: 'center',
	},
	distributionCellStrong: {
		fontFamily: 'Helvetica-Bold',
		color: '#0b4f77',
	},
	distributionCellLast: {
		borderRightWidth: 0,
	},
	distributionMealCol: {
		width: 158,
	},
	distributionProteinCol: {
		width: 74,
	},
	distributionCarbohydrateCol: {
		width: 84,
	},
	distributionLipidCol: {
		width: 74,
	},
	distributionCaloriesCol: {
		width: 78,
	},
	distributionQuantityCol: {
		width: 66,
	},
	distributionReferenceRow: {
		flexDirection: 'row',
		borderWidth: 1,
		borderColor: '#c9dfea',
		borderRadius: 6,
		overflow: 'hidden',
		backgroundColor: '#eaf5fc',
	},
	distributionReferenceCell: {
		paddingVertical: 4,
		paddingHorizontal: 6,
		fontSize: 7.8,
		fontFamily: 'Helvetica-Bold',
		color: '#0b4f77',
		borderRightWidth: 1,
		borderRightColor: '#d8e8f1',
	},
	distributionReferenceCellCenter: {
		textAlign: 'center',
	},
	distributionReferenceCellLast: {
		borderRightWidth: 0,
	},
	infographicIntroText: {
		fontSize: 8.9,
		color: '#334155',
		marginBottom: 8,
	},
	infographicHeaderRow: {
		flexDirection: 'row',
		paddingHorizontal: 2,
		paddingBottom: 5,
		borderBottomWidth: 1,
		borderBottomColor: '#c9dfea',
		marginBottom: 2,
	},
	infographicHeaderMicronutrientCol: {
		width: 230,
		fontSize: 8.6,
		fontFamily: 'Helvetica-Bold',
		color: '#0c4a6e',
	},
	infographicHeaderValueCol: {
		width: 98,
		fontSize: 8.6,
		fontFamily: 'Helvetica-Bold',
		color: '#0c4a6e',
	},
	infographicHeaderReferenceCol: {
		width: 110,
		fontSize: 8.6,
		fontFamily: 'Helvetica-Bold',
		color: '#0c4a6e',
	},
	infographicHeaderDriCol: {
		flexGrow: 1,
		fontSize: 8.6,
		fontFamily: 'Helvetica-Bold',
		color: '#0c4a6e',
	},
	infographicRow: {
		flexDirection: 'row',
		paddingVertical: 2.5,
		paddingHorizontal: 2,
		alignItems: 'center',
		borderBottomWidth: 1,
		borderBottomColor: '#e2edf3',
	},
	infographicRowEven: {
		backgroundColor: '#ffffff',
	},
	infographicRowOdd: {
		backgroundColor: '#f8fcff',
	},
	infographicNutrientCell: {
		width: 230,
		fontSize: 8.1,
		color: '#0f172a',
	},
	infographicValueCell: {
		width: 98,
		fontSize: 8.1,
		color: '#0f172a',
	},
	infographicReferenceCell: {
		width: 110,
		fontSize: 8.1,
		color: '#475569',
	},
	infographicBarCell: {
		flexGrow: 1,
	},
	infographicBarTrack: {
		height: 8,
		borderRadius: 3,
		backgroundColor: '#e5e7eb',
		overflow: 'hidden',
	},
	infographicBarFill: {
		height: 8,
		borderRadius: 3,
	},
	infographicBarPositive: {
		backgroundColor: '#22a55a',
	},
	infographicBarNegative: {
		backgroundColor: '#ef4444',
	},
	infographicBarNeutral: {
		backgroundColor: '#94a3b8',
	},
	infographicHintText: {
		marginTop: 8,
		fontSize: 7.6,
		color: '#64748b',
	},
	recipeIntroText: {
		fontSize: 9,
		color: '#334155',
		marginBottom: 8,
	},
	recipeCard: {
		borderWidth: 1.2,
		borderColor: '#9fc8dd',
		borderRadius: 10,
		backgroundColor: '#ffffff',
		paddingVertical: 8,
		paddingHorizontal: 9,
		marginBottom: 8,
		overflow: 'hidden',
	},
	recipeCardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	recipeCardIndexBadge: {
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: '#d4ebf8',
		borderWidth: 1,
		borderColor: '#9fc8dd',
		color: '#0b4f77',
		fontFamily: 'Helvetica-Bold',
		fontSize: 8.8,
		textAlign: 'center',
		paddingTop: 4,
		marginRight: 6,
	},
	recipeCardHeaderContent: {
		flexGrow: 1,
		minWidth: 0,
	},
	recipeCardTitle: {
		fontSize: 9.6,
		fontFamily: 'Helvetica-Bold',
		color: '#0b4f77',
		lineHeight: 1.2,
	},
	recipeCardSubtitle: {
		fontSize: 7.6,
		color: '#64748b',
		marginTop: 1.5,
		lineHeight: 1.2,
	},
	recipeMetaRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 7,
		marginBottom: 7,
	},
	recipeMetaCardBase: {
		width: '100%',
		borderWidth: 1,
		borderColor: '#c7dce8',
		borderRadius: 6,
		backgroundColor: '#f8fcff',
		paddingVertical: 5,
		paddingHorizontal: 6,
		marginRight: 0,
		marginBottom: 6,
	},
	recipeMetaCardShort: {
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 0,
		minWidth: 0,
		borderWidth: 1,
		borderColor: '#c7dce8',
		borderRadius: 6,
		backgroundColor: '#f8fcff',
		paddingVertical: 5,
		paddingHorizontal: 6,
		marginRight: 6,
	},
	recipeMetaCardLast: {
		marginRight: 0,
	},
	recipeMetaLabel: {
		fontSize: 7.2,
		fontFamily: 'Helvetica-Bold',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
		color: '#0c4a6e',
		marginBottom: 2,
	},
	recipeMetaValue: {
		fontSize: 8,
		lineHeight: 1.3,
		color: '#0f172a',
		maxWidth: '100%',
	},
	recipeMetaValueStrong: {
		fontSize: 8.4,
		fontFamily: 'Helvetica-Bold',
		lineHeight: 1.25,
		color: '#0b4f77',
		maxWidth: '100%',
	},
	recipeMetaListRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 1.8,
	},
	recipeMetaListBullet: {
		width: 8,
		fontSize: 7.8,
		fontFamily: 'Helvetica-Bold',
		color: '#0b4f77',
	},
	recipeMetaListText: {
		flexGrow: 1,
		fontSize: 7.9,
		lineHeight: 1.28,
		color: '#0f172a',
		maxWidth: '100%',
	},
	recipeSection: {
		borderWidth: 1,
		borderColor: '#d8e8f1',
		borderRadius: 6,
		backgroundColor: '#fbfdff',
		paddingVertical: 5,
		paddingHorizontal: 6,
		marginBottom: 6,
	},
	recipeSectionLast: {
		marginBottom: 0,
	},
	recipeSectionTitle: {
		fontSize: 7.6,
		fontFamily: 'Helvetica-Bold',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		color: '#0c4a6e',
		marginBottom: 3,
	},
	recipeListRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 2.2,
	},
	recipeListBullet: {
		width: 10,
		fontSize: 8.3,
		fontFamily: 'Helvetica-Bold',
		color: '#0b4f77',
	},
	recipeListText: {
		flexGrow: 1,
		fontSize: 8.1,
		lineHeight: 1.32,
		color: '#0f172a',
		maxWidth: '100%',
	},
	recipeStepRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 2.2,
	},
	recipeStepIndex: {
		width: 15,
		fontSize: 8.1,
		fontFamily: 'Helvetica-Bold',
		color: '#0b4f77',
	},
	recipeStepText: {
		flexGrow: 1,
		fontSize: 8.1,
		lineHeight: 1.32,
		color: '#0f172a',
		maxWidth: '100%',
	},
	recipeEmptyText: {
		fontSize: 8,
		color: '#64748b',
		fontStyle: 'italic',
	},
	recipeHintText: {
		marginTop: 4,
		fontSize: 7.6,
		lineHeight: 1.35,
		color: '#475569',
	},
})

function normalizeTextField(value: string) {
	return value.trim().replace(/\s+/g, ' ')
}

function normalizeMultilineTextField(value: string) {
	return value
		.replace(/\r/g, '')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.join('\n')
}

function splitMultilineText(value: string) {
	const normalizedValue = normalizeMultilineTextField(value)
	if (normalizedValue.length === 0) {
		return []
	}

	return normalizedValue
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
}

function splitRecipeBaseFoodsText(value: string) {
	const normalizedValue = normalizeTextField(value)
	if (normalizedValue.length === 0) {
		return []
	}

	return normalizedValue
		.split(';')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
}

function splitRecipeMetaText(value: string) {
	const normalizedValue = normalizeTextField(value)
	if (normalizedValue.length === 0) {
		return []
	}

	return normalizedValue
		.split(/[;,]+/g)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
}

function toStartCase(value: string) {
	return value
		.trim()
		.replace(/[-_]+/g, ' ')
		.split(/\s+/)
		.filter((token) => token.length > 0)
		.map((token) => token.charAt(0).toUpperCase() + token.slice(1))
		.join(' ')
}

function formatDate(dateValue: string) {
	const parsedDate = new Date(dateValue)
	if (Number.isNaN(parsedDate.getTime())) {
		return '-'
	}

	return parsedDate.toLocaleDateString('pt-BR')
}

function calculateAgeFromIsoDate(dateValue: string) {
	const birthDate = new Date(dateValue)
	if (Number.isNaN(birthDate.getTime())) {
		return null
	}

	const now = new Date()
	let age = now.getUTCFullYear() - birthDate.getUTCFullYear()
	const hasNotHadBirthdayYet =
		now.getUTCMonth() < birthDate.getUTCMonth() ||
		(now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate())

	if (hasNotHadBirthdayYet) {
		age -= 1
	}

	return Math.max(age, 0)
}

function formatGender(gender: string) {
	const normalizedGender = gender.trim().toLowerCase()
	if (normalizedGender === 'female') {
		return 'Feminino'
	}

	if (normalizedGender === 'male') {
		return 'Masculino'
	}

	return 'Outro'
}

function formatGoalList(goalList: string) {
	return goalList
		.split(',')
		.map((goal) => goal.trim().toLowerCase())
		.filter((goal) => goal.length > 0)
		.map((goal) => GOAL_LABELS[goal] ?? toStartCase(goal))
		.join(', ')
}

function formatActivityLevel(activityLevel: string) {
	const normalizedActivityLevel = activityLevel.trim().toLowerCase()
	if (!normalizedActivityLevel) {
		return '-'
	}

	return ACTIVITY_LEVEL_LABELS[normalizedActivityLevel] ?? toStartCase(normalizedActivityLevel)
}

function formatMedicalCondition(condition: string) {
	const normalizedCondition = condition.trim().toLowerCase()
	if (!normalizedCondition) {
		return ''
	}

	return MEDICAL_CONDITION_LABELS[normalizedCondition] ?? toStartCase(normalizedCondition)
}

function formatMedicalConditionsList(medicalConditions: string[]) {
	const formattedConditions = medicalConditions
		.map((condition) => formatMedicalCondition(condition))
		.filter((condition) => condition.length > 0)

	return formattedConditions.length > 0 ? formattedConditions.join(', ') : 'Nenhuma informada'
}

function formatOptionalMetric(value: number, unit: string, decimals = 1) {
	if (!Number.isFinite(value) || value <= 0) {
		return '-'
	}

	return `${value.toFixed(decimals)} ${unit}`
}

function formatDecimalPtBr(value: number, decimals: number) {
	return value.toLocaleString('pt-BR', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	})
}

function formatAdequacyNumber(value: number, decimals: number) {
	if (!Number.isFinite(value)) {
		return '-'
	}

	return formatDecimalPtBr(value, decimals)
}

function formatAdequacyPortion(value: number) {
	if (!Number.isFinite(value)) {
		return '-'
	}

	const decimals = Number.isInteger(value) ? 0 : 1
	return formatAdequacyNumber(value, decimals)
}

function calculatePercentage(value: number, total: number) {
	if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
		return 0
	}

	return (value * 100) / total
}

function formatDistributionCellWithPercent(value: number, total: number, unit: string, valueDecimals: number) {
	const safeValue = Number.isFinite(value) ? value : 0
	const percentage = calculatePercentage(safeValue, total)

	return `${formatDecimalPtBr(safeValue, valueDecimals)} ${unit} (${formatDecimalPtBr(percentage, 0)}%)`
}

function formatDistributionMealLabel(label: string) {
	const normalizedLabel = normalizeTextField(label)
	if (!normalizedLabel) {
		return '-'
	}

	return normalizedLabel
}

function formatWeightForReport(weight: number) {
	if (!Number.isFinite(weight) || weight <= 0) {
		return '-'
	}

	return `${formatDecimalPtBr(weight, 2)} kg`
}

function formatHeightMetersForReport(heightInCentimeters: number) {
	if (!Number.isFinite(heightInCentimeters) || heightInCentimeters <= 0) {
		return '-'
	}

	return `${formatDecimalPtBr(heightInCentimeters / 100, 2)}m`
}

function formatBmiForReport(bmi: number) {
	if (!Number.isFinite(bmi) || bmi <= 0) {
		return '-'
	}

	return `${formatDecimalPtBr(bmi, 2)} kg/m2`
}

function classifyBmi(bmi: number) {
	if (!Number.isFinite(bmi) || bmi <= 0) {
		return 'Classificacao: -'
	}

	if (bmi < 18.5) {
		return 'Classificacao: Baixo peso'
	}

	if (bmi < 25) {
		return 'Classificacao: Eutrofia'
	}

	if (bmi < 30) {
		return 'Classificacao: Sobrepeso'
	}

	if (bmi < 35) {
		return 'Classificacao: Obesidade grau 1'
	}

	if (bmi < 40) {
		return 'Classificacao: Obesidade grau 2'
	}

	return 'Classificacao: Obesidade grau 3'
}

function classifyArmCircumference(armCircumference: number) {
	if (!Number.isFinite(armCircumference) || armCircumference <= 0) {
		return 'Classificacao: -'
	}

	if (armCircumference < 24) {
		return 'Classificacao: Baixo peso'
	}

	if (armCircumference < 33) {
		return 'Classificacao: Adequado'
	}

	if (armCircumference < 37) {
		return 'Classificacao: Sobrepeso'
	}

	return 'Classificacao: Obesidade'
}

function classifyWaistCircumference(waistCircumference: number, gender: string) {
	if (!Number.isFinite(waistCircumference) || waistCircumference <= 0) {
		return 'Classificacao: -'
	}

	const isFemale = gender === 'female'
	const lowRiskCutoff = isFemale ? 80 : 94
	const highRiskCutoff = isFemale ? 88 : 102

	if (waistCircumference < lowRiskCutoff) {
		return 'Classificacao: Nao apresenta risco para DCV'
	}

	if (waistCircumference < highRiskCutoff) {
		return 'Classificacao: Risco aumentado para DCV'
	}

	return 'Classificacao: Risco muito aumentado para DCV'
}

function buildPlanCaloriesTarget(patient: MealPlanPdfPatient) {
	const safeTdee = Number.isFinite(patient.tdee) && patient.tdee > 0 ? patient.tdee : 2000
	const normalizedGoal = patient.goal.toLowerCase()

	if (normalizedGoal.includes('weight-loss') || normalizedGoal.includes('emagrec')) {
		return Math.max(Math.round(safeTdee - 420), 1200)
	}

	if (normalizedGoal.includes('muscle-gain') || normalizedGoal.includes('hipertrof') || normalizedGoal.includes('ganho muscular')) {
		return Math.round(safeTdee + 250)
	}

	return Math.round(safeTdee)
}

function formatGoalSentence(goalLabel: string) {
	if (!goalLabel || goalLabel === '-') {
		return 'objetivo clinico do paciente'
	}

	return goalLabel.toLowerCase()
}

function formatMealAmount(quantity: string, measure: string) {
	const quantityLabel = normalizeTextField(quantity)
	const measureLabel = normalizeTextField(measure)

	if (quantityLabel && measureLabel) {
		return `${quantityLabel} ${measureLabel}`
	}

	if (quantityLabel) {
		return quantityLabel
	}

	if (measureLabel) {
		return measureLabel
	}

	return '-'
}

function normalizeMealGroupName(groupName: string) {
	return groupName
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
}

function resolveMealSchedule(groupName: string, groupIndex: number) {
	const normalizedGroupName = normalizeMealGroupName(groupName)

	if (normalizedGroupName.includes('cafe da manha')) {
		return '07:00'
	}

	if (normalizedGroupName.includes('lanche da manha')) {
		return '10:00'
	}

	if (normalizedGroupName.includes('almoco')) {
		return '12:30'
	}

	if (normalizedGroupName.includes('lanche da tarde')) {
		return '16:00'
	}

	if (normalizedGroupName.includes('jantar')) {
		return '19:30'
	}

	if (normalizedGroupName.includes('ceia')) {
		return '22:00'
	}

	const fallbackHour = Math.min(7 + groupIndex * 3, 22)
	return `${String(fallbackHour).padStart(2, '0')}:00`
}

function slugifyToFileName(value: string) {
	const normalizedValue = value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')

	return normalizedValue || 'paciente'
}

function sanitizeMealGroups(mealGroups: MealPlanPdfMealGroup[]) {
	const normalizedGroups = mealGroups.map((group) => {
		const normalizedGroupName = normalizeTextField(group.name)

		const normalizedItems = group.items
			.map((item) => ({
				...item,
				food: normalizeTextField(item.food),
				quantity: normalizeTextField(item.quantity),
				measure: normalizeTextField(item.measure),
				notes: normalizeTextField(item.notes),
			}))
			.filter((item) =>
				item.food.length > 0 ||
				item.quantity.length > 0 ||
				item.measure.length > 0 ||
				item.notes.length > 0,
			)

		return {
			...group,
			name: normalizedGroupName.length > 0 ? normalizedGroupName : 'Refeicao',
			items: normalizedItems,
		}
	})

	if (normalizedGroups.length > 0) {
		return normalizedGroups
	}

	return [{
		id: 'fallback-group',
		name: 'Refeicao 1',
		items: [{
			id: 'fallback-item',
			foodId: null,
			food: '-',
			quantity: '',
			measure: '',
			notes: 'Adicione itens no editor para preencher o plano.',
		}],
	}]
}

function sanitizeRecipeSuggestions(recipeSuggestions: MealPlanPdfRecipeSuggestion[]) {
	return recipeSuggestions
		.map((recipe) => ({
			...recipe,
			recipeName: normalizeTextField(recipe.recipeName),
			basedOnFoods: normalizeTextField(recipe.basedOnFoods),
			ingredients: normalizeMultilineTextField(recipe.ingredients),
			preparationMethod: normalizeMultilineTextField(recipe.preparationMethod),
			yieldInfo: normalizeTextField(recipe.yieldInfo),
			portionQuantity: normalizeTextField(recipe.portionQuantity),
		}))
		.filter((recipe) =>
			recipe.recipeName.length > 0 ||
			recipe.ingredients.length > 0 ||
			recipe.preparationMethod.length > 0 ||
			recipe.basedOnFoods.length > 0 ||
			recipe.yieldInfo.length > 0 ||
			recipe.portionQuantity.length > 0,
		)
}

function buildMealTableRows(mealGroups: MealPlanPdfMealGroup[]): MealTableRow[] {
	return mealGroups.flatMap((group, groupIndex) => {
		const normalizedGroupName = normalizeTextField(group.name) || `Refeicao ${groupIndex + 1}`
		const schedule = resolveMealSchedule(normalizedGroupName, groupIndex)
		const items = group.items.length > 0
			? group.items
			: [{
				id: `${group.id}-placeholder`,
				foodId: null,
				food: '-',
				quantity: '',
				measure: '',
				notes: '',
			}]

		return items.map((item, itemIndex) => {
			const food = normalizeTextField(item.food) || '-'
			const notes = normalizeTextField(item.notes) || '-'

			return {
				groupName: itemIndex === 0 ? normalizedGroupName : '',
				schedule: itemIndex === 0 ? schedule : '',
				food,
				amount: formatMealAmount(item.quantity, item.measure),
				notes,
				isGroupStart: itemIndex === 0,
			}
		})
	})
}

function buildOrientationTips(patient: MealPlanPdfPatient) {
	const hydrationTarget = Number.isFinite(patient.weight)
		? Math.round(patient.weight * 35)
		: 2400

	const tips = [
		`Mantenha hidratacao regular ao longo do dia (meta aproximada: ${hydrationTarget} ml/dia).`,
		'Priorize alimentos in natura ou minimamente processados e ajuste porcoes conforme saciedade.',
		'Revise o plano semanalmente com o nutricionista para adequacoes conforme resposta clinica.',
	]

	if (patient.medicalConditions.some((condition) => condition.toLowerCase().includes('diabetes'))) {
		tips.push('Distribua carboidratos ao longo do dia e evite grandes cargas glicemicas em uma unica refeicao.')
	}

	if (patient.medicalConditions.some((condition) => condition.toLowerCase().includes('hypertension'))) {
		tips.push('Reduza o sodio da dieta e limite produtos ultraprocessados e embutidos.')
	}

	return tips
}

function MealPlanPdfDocument({
	patient,
	mealGroups,
	generatedAt,
	orientationTips,
	nutritionPreview,
	recipeSuggestions,
}: {
	patient: MealPlanPdfPatient
	mealGroups: MealPlanPdfMealGroup[]
	generatedAt: string
	orientationTips?: string[]
	nutritionPreview?: MealPlanPdfNutritionPreviewData | null
	recipeSuggestions?: MealPlanPdfRecipeSuggestion[]
}) {
	const patientAge = calculateAgeFromIsoDate(patient.birthDate)
	const formattedGoals = formatGoalList(patient.goal) || '-'
	const formattedActivityLevel = formatActivityLevel(patient.activityLevel)
	const formattedMedicalConditions = formatMedicalConditionsList(patient.medicalConditions)
	const planCaloriesTarget = buildPlanCaloriesTarget(patient)
	const goalSentence = formatGoalSentence(formattedGoals)
	const mealCountLabel = String(Math.max(mealGroups.length, 0)).padStart(2, '0')
	const bmiClassification = classifyBmi(patient.bmi)
	const armClassification = classifyArmCircumference(patient.armCircumference)
	const waistClassification = classifyWaistCircumference(patient.waistCircumference, patient.gender)
	const mealTableRows = buildMealTableRows(mealGroups)
	const resolvedOrientationTips = orientationTips && orientationTips.length > 0
		? orientationTips
		: buildOrientationTips(patient)
	const resolvedNutritionPreview: MealPlanPdfNutritionPreviewData = nutritionPreview ?? {
		portionRows: [],
		totalPlanKcal: 0,
		totalProteinG: 0,
		totalCarbohydrateG: 0,
		totalLipidG: 0,
		totalQuantityG: 0,
		totalMappedFoodsCount: 0,
		estimatedItemsCount: 0,
		micronutrientRows: [],
		macronutrientRows: [],
		mealDistributionRows: [],
		infographicRows: [],
	}
	const distributionRows = resolvedNutritionPreview.mealDistributionRows.length > 0
		? resolvedNutritionPreview.mealDistributionRows
		: mealGroups.map((group, groupIndex) => {
			const mealLabel = normalizeTextField(group.name) || `Refeicao ${groupIndex + 1}`
			return {
				scheduleLabel: resolveMealSchedule(mealLabel, groupIndex),
				mealLabel,
				proteinG: 0,
				carbohydrateG: 0,
				lipidG: 0,
				caloriesKcal: 0,
				quantityG: 0,
			}
		})
	const totalDistributionProtein = resolvedNutritionPreview.totalProteinG > 0
		? resolvedNutritionPreview.totalProteinG
		: distributionRows.reduce((sum, row) => sum + row.proteinG, 0)
	const totalDistributionCarbohydrate = resolvedNutritionPreview.totalCarbohydrateG > 0
		? resolvedNutritionPreview.totalCarbohydrateG
		: distributionRows.reduce((sum, row) => sum + row.carbohydrateG, 0)
	const totalDistributionLipid = resolvedNutritionPreview.totalLipidG > 0
		? resolvedNutritionPreview.totalLipidG
		: distributionRows.reduce((sum, row) => sum + row.lipidG, 0)
	const totalDistributionCalories = resolvedNutritionPreview.totalPlanKcal > 0
		? resolvedNutritionPreview.totalPlanKcal
		: distributionRows.reduce((sum, row) => sum + row.caloriesKcal, 0)
	const totalDistributionQuantity = resolvedNutritionPreview.totalQuantityG > 0
		? resolvedNutritionPreview.totalQuantityG
		: distributionRows.reduce((sum, row) => sum + row.quantityG, 0)
	const chartBarAreaHeight = 114
	const macroChartMaxValue = Math.max(
		...distributionRows.flatMap((row) => [
			row.proteinG,
			row.carbohydrateG,
			row.lipidG,
		]),
		1,
	)
	const chartScaleValues = [
		macroChartMaxValue,
		macroChartMaxValue * 0.75,
		macroChartMaxValue * 0.5,
		macroChartMaxValue * 0.25,
		0,
	]
	const chartGroupWidth = Math.max(42, Math.floor(430 / Math.max(distributionRows.length, 1)))
	const safeWeight = Number.isFinite(patient.weight) && patient.weight > 0 ? patient.weight : 0
	const proteinPerKg = safeWeight > 0 ? totalDistributionProtein / safeWeight : 0
	const carbohydratePerKg = safeWeight > 0 ? totalDistributionCarbohydrate / safeWeight : 0
	const lipidPerKg = safeWeight > 0 ? totalDistributionLipid / safeWeight : 0
	const infographicRows = resolvedNutritionPreview.infographicRows
	const resolvedRecipeSuggestions = sanitizeRecipeSuggestions(recipeSuggestions ?? [])
	const driAudienceLabel = patient.gender === 'female'
		? 'DRI (Mulheres de 19-30 anos)'
		: 'DRI (Homens de 19-30 anos)'

	return (
			<Document title={`Plano alimentar - ${patient.name}`}>
				<Page size="A4" style={pdfStyles.reportPage}>
					<View style={pdfStyles.reportHeaderCard}>
						<Text style={pdfStyles.reportTitle}>RELATORIO NUTRICIONAL</Text>
						<Text style={pdfStyles.reportSubtitle}>
							Resumo clinico do paciente e conduta nutricional
						</Text>
					</View>

					<View style={pdfStyles.reportSectionBlock}>
						<Text style={pdfStyles.reportSectionTitle}>Dados de identificacao:</Text>
						<Text style={pdfStyles.reportLine}>Paciente: {patient.name}</Text>
						<Text style={pdfStyles.reportLine}>Data de nascimento: {formatDate(patient.birthDate)}</Text>
						<Text style={pdfStyles.reportLine}>
							Idade: {patientAge === null ? '-' : `${patientAge} anos`}
						</Text>
						<Text style={pdfStyles.reportLine}>Data da consulta: {formatDate(patient.createdAt)}</Text>
						<View style={pdfStyles.reportInfoChipContainer}>
							<Text style={pdfStyles.reportInfoChip}>Sexo: {formatGender(patient.gender)}</Text>
							<Text style={pdfStyles.reportInfoChip}>Atividade: {formattedActivityLevel}</Text>
							<Text style={pdfStyles.reportInfoChip}>Emissao: {formatDate(generatedAt)}</Text>
						</View>
					</View>

					<View style={pdfStyles.reportSectionBlock}>
						<Text style={pdfStyles.reportSectionTitle}>Dados antropometricos:</Text>
						<Text style={pdfStyles.reportLine}>Peso atual: {formatWeightForReport(patient.weight)}</Text>
					<Text style={pdfStyles.reportLine}>Altura: {formatHeightMetersForReport(patient.height)}</Text>
					<Text style={pdfStyles.reportLine}>Objetivo: {formattedGoals}</Text>

					<View style={pdfStyles.reportClassRow}>
						<Text style={pdfStyles.reportClassLeft}>
							Indice de massa corporal (IMC): {formatBmiForReport(patient.bmi)}
						</Text>
						<Text style={pdfStyles.reportClassRight}>{bmiClassification}</Text>
					</View>

					<View style={pdfStyles.reportClassRow}>
						<Text style={pdfStyles.reportClassLeft}>
							Circunferencia do braco (CB): {formatOptionalMetric(patient.armCircumference, 'cm')}
						</Text>
						<Text style={pdfStyles.reportClassRight}>{armClassification}</Text>
					</View>

						<View style={pdfStyles.reportClassRow}>
							<Text style={pdfStyles.reportClassLeft}>
								Circunferencia da cintura (CC): {formatOptionalMetric(patient.waistCircumference, 'cm')}
							</Text>
							<Text style={pdfStyles.reportClassRight}>{waistClassification}</Text>
						</View>

						<View style={pdfStyles.reportInfoChipContainer}>
							<Text style={pdfStyles.reportInfoChip}>
								TMB: {Number.isFinite(patient.bmr) ? `${Math.round(patient.bmr)} kcal` : '-'}
							</Text>
							<Text style={pdfStyles.reportInfoChip}>
								GET: {Number.isFinite(patient.tdee) ? `${Math.round(patient.tdee)} kcal` : '-'}
							</Text>
						</View>
					</View>

					<View style={pdfStyles.reportSectionBlock}>
						<Text style={pdfStyles.reportSectionTitle}>Conduta Nutricional:</Text>
						<Text style={pdfStyles.reportLineSpaced}>
						<Text style={pdfStyles.reportInlineRegular}>Plano Alimentar com </Text>
						<Text style={pdfStyles.reportInlineBold}>{planCaloriesTarget} kcal/dia</Text>
						<Text style={pdfStyles.reportInlineRegular}>, para </Text>
						<Text style={pdfStyles.reportInlineBold}>{goalSentence}</Text>
						<Text style={pdfStyles.reportInlineRegular}>, com </Text>
						<Text style={pdfStyles.reportInlineBold}>{mealCountLabel}</Text>
						<Text style={pdfStyles.reportInlineRegular}> refeicoes diarias.</Text>
					</Text>

						<Text style={pdfStyles.reportLineSpaced}>
							<Text style={pdfStyles.reportInlineBold}>Taxa Metabolica Basal (TMB): </Text>
							<Text style={pdfStyles.reportInlineRegular}>
								e a quantidade de calorias necessarias para suprir as necessidades fisiologicas
								do organismo em repouso (respiracao, batimentos cardiacos, digestao e funcao de
							todos os orgaos do nosso corpo).
						</Text>
					</Text>

					<Text style={pdfStyles.reportLineSpaced}>
						<Text style={pdfStyles.reportInlineBold}>
							TMB: {Number.isFinite(patient.bmr) ? `${Math.round(patient.bmr)} kcal` : '-'}
						</Text>
						<Text style={pdfStyles.reportInlineRegular}>
							{' '} - ingestao calorica minima necessaria para preservar as funcoes do organismo.
						</Text>
					</Text>

					<Text style={pdfStyles.reportLineSpaced}>
						<Text style={pdfStyles.reportInlineBold}>Gasto Energetico Total (GET): </Text>
						<Text style={pdfStyles.reportInlineRegular}>
							e a quantidade de energia utilizada para as funcoes fisiologicas e atividade
							fisica desenvolvida durante o dia para manutencao do peso (tarefas diarias,
							caminhadas, musculacao, ginastica, etc.).
						</Text>
					</Text>

						<Text style={pdfStyles.reportLine}>
							<Text style={pdfStyles.reportInlineBold}>
								GET: {Number.isFinite(patient.tdee) ? `${Math.round(patient.tdee)} kcal` : '-'}
							</Text>
							<Text style={pdfStyles.reportInlineRegular}>
								{' '} - ingestao calorica recomendada para as atividades realizadas durante o dia.
							</Text>
						</Text>
						<Text style={pdfStyles.reportLineSpaced}>
							<Text style={pdfStyles.reportInlineBold}>Condicoes medicas: </Text>
							<Text style={pdfStyles.reportInlineRegular}>{formattedMedicalConditions}</Text>
						</Text>
					</View>
				</Page>

			<Page size="A4" style={pdfStyles.page}>
				<View style={pdfStyles.headerCard}>
					<Text style={pdfStyles.headerTitle}>PLANO ALIMENTAR</Text>
					<Text style={pdfStyles.headerSubtitle}>Distribuicao das refeicoes e itens do cardapio</Text>
				</View>

				<View style={pdfStyles.tableContainer}>
					<View style={pdfStyles.tableHeaderRow}>
						<Text style={[pdfStyles.tableHeaderCell, pdfStyles.groupCol]}>Refeicao</Text>
						<Text style={[pdfStyles.tableHeaderCell, pdfStyles.scheduleCol]}>Horario</Text>
						<Text style={[pdfStyles.tableHeaderCell, pdfStyles.foodCol]}>Alimento</Text>
						<Text style={[pdfStyles.tableHeaderCell, pdfStyles.amountCol]}>Quantidade</Text>
						<Text style={[pdfStyles.tableHeaderCell, pdfStyles.notesCol, pdfStyles.tableHeaderCellLast]}>
							Observacoes
						</Text>
					</View>

					{mealTableRows.map((row, rowIndex) => (
						<View
							key={`${row.groupName || 'row'}-${rowIndex}`}
							style={row.isGroupStart
								? rowIndex > 0
									? rowIndex % 2 === 0
										? [pdfStyles.tableRow, pdfStyles.tableRowEven, pdfStyles.tableRowStart, pdfStyles.tableRowGroupDivider]
										: [pdfStyles.tableRow, pdfStyles.tableRowOdd, pdfStyles.tableRowStart, pdfStyles.tableRowGroupDivider]
									: rowIndex % 2 === 0
										? [pdfStyles.tableRow, pdfStyles.tableRowEven, pdfStyles.tableRowStart]
										: [pdfStyles.tableRow, pdfStyles.tableRowOdd, pdfStyles.tableRowStart]
								: rowIndex % 2 === 0
									? [pdfStyles.tableRow, pdfStyles.tableRowEven]
									: [pdfStyles.tableRow, pdfStyles.tableRowOdd]}
							wrap={false}
						>
							<Text style={row.groupName
								? [pdfStyles.tableCell, pdfStyles.groupCol, pdfStyles.tableCellStrong]
								: [pdfStyles.tableCell, pdfStyles.groupCol, pdfStyles.tableCellMuted]}
							>
								{row.groupName || '-'}
							</Text>

							<Text style={row.schedule
								? [pdfStyles.tableCell, pdfStyles.scheduleCol, pdfStyles.tableCellStrong]
								: [pdfStyles.tableCell, pdfStyles.scheduleCol, pdfStyles.tableCellMuted]}
							>
								{row.schedule || '-'}
							</Text>

							<Text style={[pdfStyles.tableCell, pdfStyles.foodCol]}>{row.food}</Text>
							<Text style={[pdfStyles.tableCell, pdfStyles.amountCol, pdfStyles.tableCellStrong]}>{row.amount}</Text>
							<Text style={row.notes === '-'
								? [pdfStyles.tableCell, pdfStyles.notesCol, pdfStyles.tableCellMuted, pdfStyles.tableCellLast]
								: [pdfStyles.tableCell, pdfStyles.notesCol, pdfStyles.tableCellLast]}
							>
								{row.notes}
							</Text>
						</View>
					))}
				</View>

				<Text style={pdfStyles.footerText}>
					Paciente: {patient.name} | Data de emissao: {formatDate(generatedAt)}
				</Text>
			</Page>

			<Page size="A4" style={pdfStyles.page}>
				<View style={pdfStyles.headerCard}>
					<Text style={pdfStyles.headerTitle}>ORIENTACOES NUTRICIONAIS</Text>
					<Text style={pdfStyles.headerSubtitle}>Recomendacoes clinicas para adesao ao plano alimentar</Text>
				</View>

				<View style={[pdfStyles.section, pdfStyles.orientationSection]}>
					<Text style={pdfStyles.sectionTitle}>Orientacoes ao paciente</Text>
					{resolvedOrientationTips.map((tip, index) => (
						<View key={`${index}-${tip}`} style={pdfStyles.listRow}>
							<Text style={pdfStyles.listBullet}>-</Text>
							<Text style={pdfStyles.listText}>{tip}</Text>
						</View>
					))}
				</View>

				<Text style={pdfStyles.footerText}>
					Paciente: {patient.name} | Data de emissao: {formatDate(generatedAt)}
				</Text>
			</Page>

			<Page size="A4" style={pdfStyles.page}>
				<View style={pdfStyles.headerCard}>
					<Text style={pdfStyles.headerTitle}>RECEITAS SUGERIDAS</Text>
					<Text style={pdfStyles.headerSubtitle}>Sugestoes praticas para orientar o paciente no dia a dia</Text>
				</View>

				<Text style={pdfStyles.recipeIntroText}>
					Receitas preenchidas na etapa de montagem do plano alimentar.
				</Text>

					{resolvedRecipeSuggestions.length > 0 ? (
						resolvedRecipeSuggestions.map((recipe, index) => {
							const ingredientLines = splitMultilineText(recipe.ingredients)
							const preparationLines = splitMultilineText(recipe.preparationMethod)
							const baseFoodsLines = splitRecipeBaseFoodsText(recipe.basedOnFoods)
							const portionLines = splitRecipeMetaText(recipe.portionQuantity)

							return (
								<View key={`pdf-recipe-${recipe.id}`} style={pdfStyles.recipeCard} wrap={false}>
									<View style={pdfStyles.recipeCardHeader}>
										<Text style={pdfStyles.recipeCardIndexBadge}>{index + 1}</Text>
										<View style={pdfStyles.recipeCardHeaderContent}>
										<Text style={pdfStyles.recipeCardTitle}>
											{recipe.recipeName || 'Receita sem nome'}
										</Text>
										<Text style={pdfStyles.recipeCardSubtitle}>
											Sugestao orientativa para o plano alimentar
										</Text>
									</View>
								</View>

									<View style={pdfStyles.recipeMetaRow}>
										<View style={pdfStyles.recipeMetaCardBase}>
											<Text style={pdfStyles.recipeMetaLabel}>Base de alimentos</Text>
											{baseFoodsLines.length > 0 ? (
												baseFoodsLines.map((line, lineIndex) => (
													<View key={`${recipe.id}-base-food-${lineIndex}`} style={pdfStyles.recipeMetaListRow}>
														<Text style={pdfStyles.recipeMetaListBullet}>-</Text>
														<Text style={pdfStyles.recipeMetaListText}>{line}</Text>
													</View>
												))
											) : (
												<Text style={pdfStyles.recipeMetaValue}>Nao informado</Text>
											)}
										</View>

										<View style={pdfStyles.recipeMetaCardShort}>
											<Text style={pdfStyles.recipeMetaLabel}>Rendimento</Text>
										<Text style={pdfStyles.recipeMetaValueStrong}>
											{recipe.yieldInfo || '-'}
										</Text>
									</View>

										<View style={[pdfStyles.recipeMetaCardShort, pdfStyles.recipeMetaCardLast]}>
											<Text style={pdfStyles.recipeMetaLabel}>Porcao</Text>
											{portionLines.length > 0 ? (
												portionLines.map((line, lineIndex) => (
													<Text key={`${recipe.id}-portion-${lineIndex}`} style={pdfStyles.recipeMetaValueStrong}>
														{line}
													</Text>
												))
											) : (
												<Text style={pdfStyles.recipeMetaValueStrong}>-</Text>
											)}
										</View>
									</View>

								<View style={pdfStyles.recipeSection}>
									<Text style={pdfStyles.recipeSectionTitle}>Ingredientes</Text>
									{ingredientLines.length > 0 ? (
										ingredientLines.map((line, lineIndex) => (
											<View key={`${recipe.id}-ingredient-${lineIndex}`} style={pdfStyles.recipeListRow}>
												<Text style={pdfStyles.recipeListBullet}>-</Text>
												<Text style={pdfStyles.recipeListText}>{line}</Text>
											</View>
										))
									) : (
										<Text style={pdfStyles.recipeEmptyText}>Nao informado.</Text>
									)}
								</View>

								<View style={[pdfStyles.recipeSection, pdfStyles.recipeSectionLast]}>
									<Text style={pdfStyles.recipeSectionTitle}>Modo de preparo</Text>
									{preparationLines.length > 0 ? (
										preparationLines.map((line, lineIndex) => (
											<View key={`${recipe.id}-preparation-${lineIndex}`} style={pdfStyles.recipeStepRow}>
												<Text style={pdfStyles.recipeStepIndex}>{lineIndex + 1}.</Text>
												<Text style={pdfStyles.recipeStepText}>{line}</Text>
											</View>
										))
									) : (
										<Text style={pdfStyles.recipeEmptyText}>Nao informado.</Text>
									)}
								</View>
							</View>
						)
					})
				) : (
					<View style={pdfStyles.recipeCard}>
						<Text style={pdfStyles.recipeEmptyText}>
							Nenhuma receita foi preenchida nesta versao do plano.
						</Text>
					</View>
				)}

				<Text style={pdfStyles.recipeHintText}>
					Essas receitas sao orientativas e podem ser ajustadas pelo nutricionista conforme rotina e preferencias do paciente.
				</Text>

				<Text style={pdfStyles.footerText}>
					Paciente: {patient.name} | Data de emissao: {formatDate(generatedAt)}
				</Text>
			</Page>

			<Page size="A4" style={pdfStyles.page}>
				<View style={pdfStyles.headerCard}>
					<Text style={pdfStyles.headerTitle}>ADEQUACAO DO PLANO</Text>
					<Text style={pdfStyles.headerSubtitle}>Porcoes, energia total e analise de macro e micronutrientes</Text>
				</View>

				<Text style={pdfStyles.adequacyIntroText}>
					Itens mapeados na TACO: {resolvedNutritionPreview.totalMappedFoodsCount} |
					Itens com estimativa de medida: {resolvedNutritionPreview.estimatedItemsCount}
				</Text>

				<View style={pdfStyles.adequacyTableContainer}>
					<View style={pdfStyles.adequacyTableTitleRow}>
						<Text style={pdfStyles.adequacyTableTitleText}>Numero total de porcoes no plano alimentar</Text>
					</View>

					<View style={pdfStyles.adequacyHeaderRow}>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyGroupCol]}>Grupo</Text>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyPortionCol, pdfStyles.adequacyCellCenter, pdfStyles.adequacyHeaderCellLast]}>
							Numero de porcoes
						</Text>
					</View>

					{resolvedNutritionPreview.portionRows.length > 0 ? (
						resolvedNutritionPreview.portionRows.map((row, index) => (
							<View
								key={`portion-row-${row.groupName}`}
								style={index % 2 === 0
									? [pdfStyles.adequacyRow, pdfStyles.adequacyRowEven]
									: [pdfStyles.adequacyRow, pdfStyles.adequacyRowOdd]}
							>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyGroupCol]}>{row.groupName}</Text>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyPortionCol, pdfStyles.adequacyCellCenter, pdfStyles.adequacyCellLast]}>
									{formatAdequacyPortion(row.portions)}
								</Text>
							</View>
						))
					) : (
						<View style={pdfStyles.adequacySectionRow}>
							<Text style={pdfStyles.adequacySectionText}>
								Sem porcoes calculadas ainda. Preencha alimentos no editor para gerar o resumo.
							</Text>
						</View>
					)}

					<View style={[pdfStyles.adequacyRow, pdfStyles.adequacyRowEven]}>
						<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyGroupCol, pdfStyles.adequacyCellStrong]}>
							Total (kcal)
						</Text>
						<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyPortionCol, pdfStyles.adequacyCellCenter, pdfStyles.adequacyCellStrong, pdfStyles.adequacyCellLast]}>
							{formatAdequacyNumber(resolvedNutritionPreview.totalPlanKcal, 0)} kcal
						</Text>
					</View>
				</View>

				<View style={pdfStyles.adequacyTableContainer}>
					<View style={pdfStyles.adequacyTableTitleRow}>
						<Text style={pdfStyles.adequacyTableTitleText}>Adequacao</Text>
					</View>

					<View style={pdfStyles.adequacyHeaderRow}>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyNutrientCol]}>Nutriente</Text>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyOfferedCol, pdfStyles.adequacyCellCenter]}>Valor</Text>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyEarCol, pdfStyles.adequacyCellCenter]}>EAR</Text>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyRdaCol, pdfStyles.adequacyCellCenter]}>RDA/AI</Text>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyUlCol, pdfStyles.adequacyCellCenter]}>UL</Text>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyAnalysisCol, pdfStyles.adequacyCellCenter, pdfStyles.adequacyHeaderCellLast]}>Analise</Text>
					</View>

					<View style={pdfStyles.adequacySectionRow}>
						<Text style={pdfStyles.adequacySectionText}>Micronutrientes</Text>
					</View>

					{resolvedNutritionPreview.micronutrientRows.length > 0 ? (
						resolvedNutritionPreview.micronutrientRows.map((row, index) => (
							<View
								key={`micronutrient-row-${row.nutrientLabel}`}
								style={index % 2 === 0
									? [pdfStyles.adequacyRow, pdfStyles.adequacyRowEven]
									: [pdfStyles.adequacyRow, pdfStyles.adequacyRowOdd]}
							>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyNutrientCol]}>{row.nutrientLabel}</Text>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyOfferedCol, pdfStyles.adequacyCellCenter]}>{row.offeredLabel}</Text>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyEarCol, pdfStyles.adequacyCellCenter]}>{row.earLabel}</Text>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyRdaCol, pdfStyles.adequacyCellCenter]}>{row.rdaOrAiLabel}</Text>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyUlCol, pdfStyles.adequacyCellCenter]}>{row.ulLabel}</Text>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyAnalysisCol, pdfStyles.adequacyCellCenter, pdfStyles.adequacyCellStrong, pdfStyles.adequacyCellLast]}>
									{row.analysis}
								</Text>
							</View>
						))
					) : (
						<View style={pdfStyles.adequacySectionRow}>
							<Text style={pdfStyles.adequacySectionText}>Sem micronutrientes calculados.</Text>
						</View>
					)}

					<View style={pdfStyles.adequacySectionRow}>
						<Text style={pdfStyles.adequacySectionText}>Macronutrientes</Text>
					</View>

					<View style={pdfStyles.adequacyHeaderRow}>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyNutrientCol]}>Nutriente</Text>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyOfferedCol, pdfStyles.adequacyCellCenter]}>Valor</Text>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyRecommendedCol, pdfStyles.adequacyCellCenter]}>Recomendacao</Text>
						<Text style={[pdfStyles.adequacyHeaderCell, pdfStyles.adequacyAnalysisCol, pdfStyles.adequacyCellCenter, pdfStyles.adequacyHeaderCellLast]}>Analise</Text>
					</View>

					{resolvedNutritionPreview.macronutrientRows.length > 0 ? (
						resolvedNutritionPreview.macronutrientRows.map((row, index) => (
							<View
								key={`macronutrient-row-${row.nutrientLabel}`}
								style={index % 2 === 0
									? [pdfStyles.adequacyRow, pdfStyles.adequacyRowEven]
									: [pdfStyles.adequacyRow, pdfStyles.adequacyRowOdd]}
							>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyNutrientCol]}>{row.nutrientLabel}</Text>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyOfferedCol, pdfStyles.adequacyCellCenter]}>{row.offeredLabel}</Text>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyRecommendedCol, pdfStyles.adequacyCellCenter]}>{row.recommendedLabel}</Text>
								<Text style={[pdfStyles.adequacyCell, pdfStyles.adequacyAnalysisCol, pdfStyles.adequacyCellCenter, pdfStyles.adequacyCellStrong, pdfStyles.adequacyCellLast]}>
									{row.analysis}
								</Text>
							</View>
						))
					) : (
						<View style={pdfStyles.adequacySectionRow}>
							<Text style={pdfStyles.adequacySectionText}>Sem macronutrientes calculados.</Text>
						</View>
					)}
				</View>

				<Text style={pdfStyles.footerText}>
					Paciente: {patient.name} | Data de emissao: {formatDate(generatedAt)}
				</Text>
			</Page>

			<Page size="A4" style={pdfStyles.page}>
				<View style={pdfStyles.headerCard}>
					<Text style={pdfStyles.headerTitle}>DISTRIBUICAO NUTRICIONAL</Text>
					<Text style={pdfStyles.headerSubtitle}>Macros por refeicao e resumo quantitativo do plano</Text>
				</View>

				<Text style={pdfStyles.distributionIntroText}>
					Visualizacao por refeicao com foco em proteinas, carboidratos e lipidios.
				</Text>

				<View style={pdfStyles.distributionChartCard}>
					<View style={pdfStyles.distributionChartLegendRow}>
						<View style={pdfStyles.distributionChartLegendItem}>
							<View style={[pdfStyles.distributionChartLegendSwatch, pdfStyles.distributionLegendProtein]} />
							<Text style={pdfStyles.distributionChartLegendLabel}>Proteinas</Text>
						</View>
						<View style={pdfStyles.distributionChartLegendItem}>
							<View style={[pdfStyles.distributionChartLegendSwatch, pdfStyles.distributionLegendCarbohydrate]} />
							<Text style={pdfStyles.distributionChartLegendLabel}>Carboidratos</Text>
						</View>
						<View style={pdfStyles.distributionChartLegendItem}>
							<View style={[pdfStyles.distributionChartLegendSwatch, pdfStyles.distributionLegendLipid]} />
							<Text style={pdfStyles.distributionChartLegendLabel}>Lipidios</Text>
						</View>
					</View>

					<View style={pdfStyles.distributionChartAreaRow}>
						<View style={pdfStyles.distributionChartAxis}>
							{chartScaleValues.map((scaleValue, index) => (
								<Text key={`chart-scale-${index}`} style={pdfStyles.distributionChartAxisLabel}>
									{formatDecimalPtBr(scaleValue, 0)}
								</Text>
							))}
						</View>

						<View style={pdfStyles.distributionChartPlot}>
							<View style={pdfStyles.distributionChartGrid}>
								{chartScaleValues.map((_, index) => (
									<View key={`chart-grid-${index}`} style={pdfStyles.distributionChartGridLine} />
								))}
							</View>

							<View style={pdfStyles.distributionChartBarsRow}>
								{distributionRows.map((row, index) => (
									<View
										key={`chart-row-${row.scheduleLabel}-${row.mealLabel}-${index}`}
										style={[pdfStyles.distributionChartGroup, { width: chartGroupWidth }]}
									>
										<View style={pdfStyles.distributionChartBarsStack}>
											<View
												style={[
													pdfStyles.distributionChartBar,
													pdfStyles.distributionChartBarProtein,
													{
														height: row.proteinG > 0
															? (row.proteinG / macroChartMaxValue) * chartBarAreaHeight
															: 0,
													},
												]}
											/>
											<View
												style={[
													pdfStyles.distributionChartBar,
													pdfStyles.distributionChartBarCarbohydrate,
													{
														height: row.carbohydrateG > 0
															? (row.carbohydrateG / macroChartMaxValue) * chartBarAreaHeight
															: 0,
													},
												]}
											/>
											<View
												style={[
													pdfStyles.distributionChartBar,
													pdfStyles.distributionChartBarLipid,
													{
														height: row.lipidG > 0
															? (row.lipidG / macroChartMaxValue) * chartBarAreaHeight
															: 0,
													},
												]}
											/>
										</View>
										<Text style={pdfStyles.distributionChartGroupLabel}>
											{formatDistributionMealLabel(row.mealLabel)}
										</Text>
									</View>
								))}
							</View>
						</View>
					</View>
				</View>

				<View style={pdfStyles.distributionTableContainer}>
					<View style={pdfStyles.distributionTableTitleRow}>
						<Text style={pdfStyles.distributionTableTitleText}>Tabela de distribuicao de refeicoes</Text>
					</View>

					<View style={pdfStyles.distributionHeaderRow}>
						<Text style={[pdfStyles.distributionHeaderCell, pdfStyles.distributionMealCol]}>Refeicao</Text>
						<Text style={[pdfStyles.distributionHeaderCell, pdfStyles.distributionProteinCol, pdfStyles.distributionCellCenter]}>Proteinas</Text>
						<Text style={[pdfStyles.distributionHeaderCell, pdfStyles.distributionCarbohydrateCol, pdfStyles.distributionCellCenter]}>Carboidratos</Text>
						<Text style={[pdfStyles.distributionHeaderCell, pdfStyles.distributionLipidCol, pdfStyles.distributionCellCenter]}>Lipidios</Text>
						<Text style={[pdfStyles.distributionHeaderCell, pdfStyles.distributionCaloriesCol, pdfStyles.distributionCellCenter]}>Calorias</Text>
						<Text style={[pdfStyles.distributionHeaderCell, pdfStyles.distributionQuantityCol, pdfStyles.distributionCellCenter, pdfStyles.distributionHeaderCellLast]}>Quantidade</Text>
					</View>

					{distributionRows.map((row, index) => (
						<View
							key={`distribution-table-row-${row.scheduleLabel}-${row.mealLabel}-${index}`}
							style={index % 2 === 0
								? [pdfStyles.distributionRow, pdfStyles.distributionRowEven]
								: [pdfStyles.distributionRow, pdfStyles.distributionRowOdd]}
						>
							<Text style={[pdfStyles.distributionCell, pdfStyles.distributionMealCol]}>
								{`${row.scheduleLabel} - ${formatDistributionMealLabel(row.mealLabel)}`}
							</Text>
							<Text style={[pdfStyles.distributionCell, pdfStyles.distributionProteinCol, pdfStyles.distributionCellCenter]}>
								{formatDistributionCellWithPercent(row.proteinG, totalDistributionProtein, 'g', 1)}
							</Text>
							<Text style={[pdfStyles.distributionCell, pdfStyles.distributionCarbohydrateCol, pdfStyles.distributionCellCenter]}>
								{formatDistributionCellWithPercent(row.carbohydrateG, totalDistributionCarbohydrate, 'g', 1)}
							</Text>
							<Text style={[pdfStyles.distributionCell, pdfStyles.distributionLipidCol, pdfStyles.distributionCellCenter]}>
								{formatDistributionCellWithPercent(row.lipidG, totalDistributionLipid, 'g', 1)}
							</Text>
							<Text style={[pdfStyles.distributionCell, pdfStyles.distributionCaloriesCol, pdfStyles.distributionCellCenter]}>
								{formatDistributionCellWithPercent(row.caloriesKcal, totalDistributionCalories, 'kcal', 0)}
							</Text>
							<Text style={[pdfStyles.distributionCell, pdfStyles.distributionQuantityCol, pdfStyles.distributionCellCenter, pdfStyles.distributionCellLast]}>
								{formatDistributionCellWithPercent(row.quantityG, totalDistributionQuantity, 'g', 0)}
							</Text>
						</View>
					))}

					<View style={[pdfStyles.distributionRow, pdfStyles.distributionRowEven]}>
						<Text style={[pdfStyles.distributionCell, pdfStyles.distributionMealCol, pdfStyles.distributionCellStrong]}>Total</Text>
						<Text style={[pdfStyles.distributionCell, pdfStyles.distributionProteinCol, pdfStyles.distributionCellCenter, pdfStyles.distributionCellStrong]}>
							{formatDistributionCellWithPercent(totalDistributionProtein, totalDistributionProtein, 'g', 1)}
						</Text>
						<Text style={[pdfStyles.distributionCell, pdfStyles.distributionCarbohydrateCol, pdfStyles.distributionCellCenter, pdfStyles.distributionCellStrong]}>
							{formatDistributionCellWithPercent(totalDistributionCarbohydrate, totalDistributionCarbohydrate, 'g', 1)}
						</Text>
						<Text style={[pdfStyles.distributionCell, pdfStyles.distributionLipidCol, pdfStyles.distributionCellCenter, pdfStyles.distributionCellStrong]}>
							{formatDistributionCellWithPercent(totalDistributionLipid, totalDistributionLipid, 'g', 1)}
						</Text>
						<Text style={[pdfStyles.distributionCell, pdfStyles.distributionCaloriesCol, pdfStyles.distributionCellCenter, pdfStyles.distributionCellStrong]}>
							{formatDistributionCellWithPercent(totalDistributionCalories, totalDistributionCalories, 'kcal', 0)}
						</Text>
						<Text style={[pdfStyles.distributionCell, pdfStyles.distributionQuantityCol, pdfStyles.distributionCellCenter, pdfStyles.distributionCellStrong, pdfStyles.distributionCellLast]}>
							{formatDistributionCellWithPercent(totalDistributionQuantity, totalDistributionQuantity, 'g', 0)}
						</Text>
					</View>
				</View>

				<View style={pdfStyles.distributionReferenceRow}>
					<Text style={[pdfStyles.distributionReferenceCell, pdfStyles.distributionMealCol]}>g/Kg do peso</Text>
					<Text style={[pdfStyles.distributionReferenceCell, pdfStyles.distributionProteinCol, pdfStyles.distributionReferenceCellCenter]}>
						{safeWeight > 0 ? `${formatDecimalPtBr(proteinPerKg, 2)} g/kg` : '-'}
					</Text>
					<Text style={[pdfStyles.distributionReferenceCell, pdfStyles.distributionCarbohydrateCol, pdfStyles.distributionReferenceCellCenter]}>
						{safeWeight > 0 ? `${formatDecimalPtBr(carbohydratePerKg, 2)} g/kg` : '-'}
					</Text>
					<Text style={[pdfStyles.distributionReferenceCell, pdfStyles.distributionLipidCol, pdfStyles.distributionReferenceCellCenter]}>
						{safeWeight > 0 ? `${formatDecimalPtBr(lipidPerKg, 2)} g/kg` : '-'}
					</Text>
					<Text style={[pdfStyles.distributionReferenceCell, pdfStyles.distributionCaloriesCol, pdfStyles.distributionReferenceCellCenter]}>-</Text>
					<Text style={[pdfStyles.distributionReferenceCell, pdfStyles.distributionQuantityCol, pdfStyles.distributionReferenceCellCenter, pdfStyles.distributionReferenceCellLast]}>-</Text>
				</View>

				<Text style={pdfStyles.footerText}>
					Paciente: {patient.name} | Data de emissao: {formatDate(generatedAt)}
				</Text>
			</Page>

			<Page size="A4" style={pdfStyles.page}>
				<View style={pdfStyles.headerCard}>
					<Text style={pdfStyles.headerTitle}>INFOGRAFICO NUTRICIONAL</Text>
					<Text style={pdfStyles.headerSubtitle}>Panorama dinamico dos principais micronutrientes e lipideos</Text>
				</View>

				<Text style={pdfStyles.infographicIntroText}>
					Valores calculados a partir dos alimentos selecionados no plano, com referencia de ingestao diaria recomendada.
				</Text>

				<View style={pdfStyles.infographicHeaderRow}>
					<Text style={pdfStyles.infographicHeaderMicronutrientCol}>Micronutrientes</Text>
					<Text style={pdfStyles.infographicHeaderValueCol}>Valor atual</Text>
					<Text style={pdfStyles.infographicHeaderReferenceCol}>Referencia</Text>
					<Text style={pdfStyles.infographicHeaderDriCol}>{driAudienceLabel}</Text>
				</View>

				{infographicRows.length > 0 ? (
					infographicRows.map((row, index) => {
						const valueDecimals = row.unit === 'mcg'
							? 0
							: row.unit === 'mg'
								? (row.value < 10 ? 2 : 1)
								: 2
						const valueLabel = `${formatDecimalPtBr(row.value, valueDecimals)} ${row.unit}`
						const barFillStyle = row.referenceKind === 'none'
							? pdfStyles.infographicBarNeutral
							: row.isPositive
								? pdfStyles.infographicBarPositive
								: pdfStyles.infographicBarNegative

						return (
							<View
								key={`infographic-row-${row.nutrientLabel}-${index}`}
								style={index % 2 === 0
									? [pdfStyles.infographicRow, pdfStyles.infographicRowEven]
									: [pdfStyles.infographicRow, pdfStyles.infographicRowOdd]}
							>
								<Text style={pdfStyles.infographicNutrientCell}>{row.nutrientLabel}</Text>
								<Text style={pdfStyles.infographicValueCell}>{valueLabel}</Text>
								<Text style={pdfStyles.infographicReferenceCell}>{row.referenceLabel}</Text>
								<View style={pdfStyles.infographicBarCell}>
									<View style={pdfStyles.infographicBarTrack}>
										<View
											style={[
												pdfStyles.infographicBarFill,
												barFillStyle,
												{ width: `${row.barPercentage}%` },
											]}
										/>
									</View>
								</View>
							</View>
						)
					})
				) : (
					<View style={[pdfStyles.infographicRow, pdfStyles.infographicRowEven]}>
						<Text style={pdfStyles.infographicNutrientCell}>Sem nutrientes calculados</Text>
						<Text style={pdfStyles.infographicValueCell}>-</Text>
						<Text style={pdfStyles.infographicReferenceCell}>-</Text>
						<View style={pdfStyles.infographicBarCell}>
							<View style={pdfStyles.infographicBarTrack} />
						</View>
					</View>
				)}

				<Text style={pdfStyles.infographicHintText}>
					Barras verdes indicam referencia atendida; vermelhas indicam abaixo do minimo ou acima do limite.
				</Text>

				<Text style={pdfStyles.footerText}>
					Paciente: {patient.name} | Data de emissao: {formatDate(generatedAt)}
				</Text>
			</Page>
		</Document>
	)
}

function PdfCanvasRenderer({
	pdfUrl,
	isGeneratingBlob,
	generationErrorMessage,
	downloadFileName,
}: PdfCanvasRendererProps) {
	const canvasViewportRef = useRef<HTMLDivElement | null>(null)
	const canvasHostRef = useRef<HTMLDivElement | null>(null)
	const [viewportWidth, setViewportWidth] = useState(0)
	const [isRenderingPreview, setIsRenderingPreview] = useState(false)
	const [renderingErrorMessage, setRenderingErrorMessage] = useState<string | null>(null)
	const [pageCount, setPageCount] = useState(0)

	useEffect(() => {
		const viewportElement = canvasViewportRef.current
		if (!viewportElement || typeof ResizeObserver === 'undefined') {
			return
		}

		const observer = new ResizeObserver((entries) => {
			const nextWidth = Math.round(entries[0]?.contentRect.width ?? 0)
			if (nextWidth <= 0) {
				return
			}

			setViewportWidth((previousWidth) => (
				previousWidth === 0 || Math.abs(previousWidth - nextWidth) >= 6
					? nextWidth
					: previousWidth
			))
		})

		observer.observe(viewportElement)
		return () => {
			observer.disconnect()
		}
	}, [])

	useEffect(() => {
		let isCancelled = false
		let loadingTask: ReturnType<typeof getDocument> | null = null
		let documentProxy: PDFDocumentProxy | null = null
		const activeRenderTasks: RenderTask[] = []

		const renderPdfPagesIntoCanvas = async () => {
			const hostElement = canvasHostRef.current
			if (!hostElement) {
				return
			}

			setRenderingErrorMessage(null)

			if (!pdfUrl) {
				hostElement.replaceChildren()
				setPageCount(0)
				return
			}

			try {
				setIsRenderingPreview(true)
				loadingTask = getDocument(pdfUrl)
				documentProxy = await loadingTask.promise

				if (isCancelled) {
					return
				}

				const availableWidth = Math.max(viewportWidth || hostElement.clientWidth, 320)
				const targetPageWidth = Math.max(300, Math.min(availableWidth - 8, 640))
				const nextPagesContainer = document.createDocumentFragment()
				let renderedPagesCount = 0

				for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
					if (isCancelled) {
						break
					}

					const page = await documentProxy.getPage(pageNumber)
					const viewport = page.getViewport({ scale: 1 })
					const scaledViewport = page.getViewport({ scale: targetPageWidth / viewport.width })
					const canvas = document.createElement('canvas')
					const canvasContext = canvas.getContext('2d', { alpha: false })

					if (!canvasContext) {
						continue
					}

					const pixelRatio = window.devicePixelRatio || 1
					canvas.width = Math.floor(scaledViewport.width * pixelRatio)
					canvas.height = Math.floor(scaledViewport.height * pixelRatio)
					canvas.style.width = `${Math.floor(scaledViewport.width)}px`
					canvas.style.height = `${Math.floor(scaledViewport.height)}px`
					canvas.className = 'block rounded-lg border border-[#e2edf3] bg-white'
					canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

					const pageCard = document.createElement('div')
					pageCard.className = 'w-fit rounded-2xl border border-[#d3e3eb] bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]'
					const pageBadge = document.createElement('div')
					pageBadge.className = 'mb-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-slate-500'
					pageBadge.textContent = `Pagina ${pageNumber}`
					pageCard.appendChild(pageBadge)
					pageCard.appendChild(canvas)
					nextPagesContainer.appendChild(pageCard)

					const renderTask = page.render({
						canvas,
						canvasContext,
						viewport: scaledViewport,
					})
					activeRenderTasks.push(renderTask)
					await renderTask.promise
					renderedPagesCount += 1
					page.cleanup()
				}

				if (!isCancelled) {
					hostElement.replaceChildren(nextPagesContainer)
					setPageCount(renderedPagesCount)
				}
			} catch (error) {
				if (isCancelled) {
					return
				}

				const message = error instanceof Error
					? error.message
					: 'Nao foi possivel renderizar o preview do PDF.'
				setRenderingErrorMessage(message)
			} finally {
				if (documentProxy) {
					await documentProxy.cleanup()
					await documentProxy.destroy()
				}

				if (!isCancelled) {
					setIsRenderingPreview(false)
				}
			}
		}

		void renderPdfPagesIntoCanvas()

		return () => {
			isCancelled = true
			if (loadingTask) {
				loadingTask.destroy()
			}
			for (const renderTask of activeRenderTasks) {
				renderTask.cancel()
			}
		}
	}, [pdfUrl, viewportWidth])

	const errorMessage = generationErrorMessage ?? renderingErrorMessage
	const isLoading = isGeneratingBlob || isRenderingPreview
	const shouldShowLoadingOverlay = isLoading && pageCount === 0

	return (
		<div className="flex h-full min-h-[360px] w-full flex-col rounded-3xl border border-[#c8d7df] bg-[linear-gradient(180deg,#f9fcff_0%,#f1f7fb_100%)]">
			<div className="flex items-center justify-between border-b border-[#d7e5ec] px-4 py-3">
				<div className="text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-slate-500">
					Preview em canvas
				</div>
				<div className="text-xs font-semibold text-slate-500">
					{pageCount > 0 ? `${pageCount} pagina(s)` : 'Sem paginas'}
				</div>
			</div>

			<div ref={canvasViewportRef} className="relative min-h-0 flex-1 overflow-y-auto">
				<div
					ref={canvasHostRef}
					className="flex min-h-full w-full flex-col items-center gap-3 px-3 py-3"
				/>

					{!shouldShowLoadingOverlay && !errorMessage && pageCount === 0 ? (
						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
							<p className="text-sm font-semibold text-slate-800">Sem conteudo para preview</p>
							<p className="mt-1 text-xs text-slate-600">
								Preencha os grupos e itens para montar as paginas do PDF.
							</p>
						</div>
					) : null}

					{shouldShowLoadingOverlay ? (
						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/72 px-4 text-center backdrop-blur-[1px]">
							<div className="h-8 w-8 animate-spin rounded-full border-2 border-[#9ad0e5] border-t-[#1b88ab]" />
							<p className="mt-3 text-xs font-semibold uppercase tracking-[0.11em] text-[#1b7f9e]">
								Atualizando preview
						</p>
					</div>
				) : null}

				{errorMessage ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
						<p className="text-sm font-semibold text-red-700">Falha ao gerar o preview</p>
						<p className="mt-2 max-w-[320px] text-xs text-red-600">{errorMessage}</p>
					</div>
				) : null}
			</div>

			<div className="border-t border-[#d7e5ec] px-4 py-3">
				{pdfUrl ? (
					<a
						href={pdfUrl}
						download={downloadFileName}
						className="inline-flex items-center rounded-md border border-[#98c5d7] bg-white px-3 py-1.5 text-xs font-semibold text-[#16607f] transition-colors hover:bg-[#f0f8fc]"
					>
						Baixar PDF local
					</a>
				) : (
					<button
						type="button"
						disabled
						className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500"
					>
						Baixar PDF local
					</button>
				)}
			</div>
		</div>
	)
}

export function MealPlanPdfCanvasPreview({ patient, mealGroups, orientationTips, nutritionPreview, recipeSuggestions }: MealPlanPdfCanvasPreviewProps) {
	const sanitizedMealGroups = useMemo(
		() => sanitizeMealGroups(mealGroups),
		[mealGroups],
	)
	const generatedAt = useMemo(() => new Date().toISOString(), [])
	const downloadFileName = useMemo(
		() => `plano-alimentar-${slugifyToFileName(patient.name)}.pdf`,
		[patient.name],
	)
	const pdfDocumentElement = useMemo(
		() => (
				<MealPlanPdfDocument
					patient={patient}
					mealGroups={sanitizedMealGroups}
					generatedAt={generatedAt}
					orientationTips={orientationTips}
					nutritionPreview={nutritionPreview}
					recipeSuggestions={recipeSuggestions}
				/>
			),
		[generatedAt, nutritionPreview, orientationTips, patient, recipeSuggestions, sanitizedMealGroups],
	)

	return (
		<BlobProvider document={pdfDocumentElement}>
			{({ url, loading, error }) => (
				<PdfCanvasRenderer
					pdfUrl={url ?? null}
					isGeneratingBlob={loading}
					generationErrorMessage={error instanceof Error ? error.message : null}
					downloadFileName={downloadFileName}
				/>
			)}
		</BlobProvider>
	)
}
