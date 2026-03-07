import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, Grid, Group, Pagination, Skeleton, Stack, Table, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IoAlertCircleOutline, IoCheckmarkCircleOutline } from 'react-icons/io5'
import { MdDeleteOutline, MdDownload, MdEdit } from 'react-icons/md'
import { useNavigate, useParams } from 'react-router-dom'

import ButtonStyle from '../components/mantine/buttons/PrimaryButton.module.css'
import { AppModal } from '../components/mantine/modals/AppModal'
import NotificationStyle from '../components/mantine/notifications/Notification.module.css'
import { SideBar } from '../components/custom/sidebar/SideBar'
import { PageInfo } from '../components/custom/pageInfo/PageInfo'
import { PageContentContainer } from '../components/custom/pageContentContainer/PageContentContainer'
import {
	MealPlanPdfCanvasPreview,
	type MealPlanPdfBlobState,
	type MealPlanPdfNutritionPreviewData,
	type MealPlanPdfNutritionistProfile,
} from '../components/custom/pdf/MealPlanPdfCanvasPreview'

import { useAuth } from '../auth/AuthContext'
import { APP_SIDEBAR_ITEMS } from '../lib/sidebarItems'
import { cn } from '../lib/utils'

type PatientDetailsResponse = {
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

type CurrentNutritionistProfileResponse = {
	id: number
	name: string
	email: string
	createdAt: string
	phone: string | null
	crn: string | null
	institution: string | null
	profilePicture: string | null
	city: string | null
	state: string | null
}

type SavedPatientMenuNutritionGuidanceResponse = {
	hydrationGoalMl: number | null
	mealRoutineGuidance: string
	foodQualityGuidance: string
	preparationGuidance: string
	behaviorGuidance: string
	symptomMonitoringGuidance: string
	restrictionsGuidance: string
	additionalGuidance: string
}

type SavedPatientMenuAiGenerationSettingsResponse = {
	modelOverride: string | null
	planningFocus: string
	clinicalStrictness: string
	preparationProfile: string
	budgetProfile: string
	maxItemsPerGroup: number
	preferredFoods: string
	restrictedFoods: string
	extraInstructions: string
}

type SavedPatientMenuAiRecipeGenerationSettingsResponse = {
	modelOverride: string | null
	recipeFocus: string
	preparationProfile: string
	budgetProfile: string
	recipeCount: number
	maxIngredientsPerRecipe: number
	preferredFoods: string
	restrictedFoods: string
	extraInstructions: string
}

type SavedPatientMenuResponse = {
	id: number
	patientId: number
	activeDataEntryStep: number
	mealGroups: SavedPatientMenuMealGroupResponse[]
	nutritionGuidance: SavedPatientMenuNutritionGuidanceResponse
	aiGuidanceHighlights: string[]
	recipeSuggestions: SavedPatientMenuRecipeSuggestionResponse[]
	aiGenerationSettings: SavedPatientMenuAiGenerationSettingsResponse
	aiRecipeGenerationSettings: SavedPatientMenuAiRecipeGenerationSettingsResponse
	createdAt: string
	updatedAt: string
}

type SavedPatientMenuHistoryResponse = {
	page: number
	pageSize: number
	totalCount: number
	totalPages: number
	items: SavedPatientMenuResponse[]
}

type SavedPatientMenuMealGroupResponse = {
	id: string
	name: string
	scheduleTime: string
	items: SavedPatientMenuMealItemResponse[]
}

type SavedPatientMenuMealItemResponse = {
	id: string
	foodId: string | null
	food: string
	quantity: string
	measure: string
	notes: string
}

type SavedPatientMenuRecipeSuggestionResponse = {
	id: string
	recipeName: string
	basedOnFoods: string
	ingredients: string
	preparationMethod: string
	yieldInfo: string
	portionQuantity: string
}

type SavedPatientMenuSummary = {
	id: number
	activeDataEntryStep: number
	mealGroupsCount: number
	mealItemsCount: number
	recipeSuggestionsCount: number
	createdAt: string
	updatedAt: string
	source: SavedPatientMenuResponse
}

type InfoFieldProps = {
	label: string
	value: string
}

type PillMeta = {
	label: string
	className: string
}

type TacoFoodTableEntry = {
	id: number
	description: string
	category: string
	energy_kcal: unknown
	carbohydrate_g: unknown
	protein_g: unknown
	lipid_g: unknown
	fiber_g: unknown
	cholesterol_mg: unknown
	iron_mg: unknown
	magnesium_mg: unknown
	phosphorus_mg: unknown
	sodium_mg: unknown
	potassium_mg: unknown
	saturated_g: unknown
	monounsaturated_g: unknown
	polyunsaturated_g: unknown
	'18:1t_g': unknown
	'18:2t_g': unknown
	vitaminC_mg: unknown
	thiamine_mg: unknown
	riboflavin_mg: unknown
	niacin_mg: unknown
	pyridoxine_mg: unknown
	retinol_mcg: unknown
	rae_mcg: unknown
	calcium_mg: unknown
	manganese_mg: unknown
	zinc_mg: unknown
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
const LOAD_PATIENT_DETAILS_ERROR_MESSAGE = 'Não foi possível carregar os detalhes do paciente.'
const LOAD_PATIENT_MENU_ERROR_MESSAGE = 'Não foi possível carregar os cardápios salvos do paciente.'
const DELETE_PATIENT_MENU_ERROR_MESSAGE = 'Não foi possível excluir o cardápio salvo.'
const SAVED_MENUS_PAGE_SIZE = 5
const DEFAULT_PILL_CLASS = 'border border-slate-200 bg-slate-100 text-slate-700'
const GOAL_LABELS: Record<string, string> = {
	'weight-loss': 'Emagrecimento',
	'muscle-gain': 'Ganho muscular',
	'dietary-reeducation': 'Reeducação alimentar',
	'weight-maintenance': 'Manutenção de peso',
	'sports-performance': 'Performance esportiva',
	'metabolic-health': 'Saúde metabólica',
	'intestinal-health': 'Saúde intestinal',
}
const MEDICAL_CONDITION_LABELS: Record<string, string> = {
	diabetes: 'Diabetes',
	hypertension: 'Hipertensão',
	dyslipidemia: 'Dislipidemia',
	'heart-disease': 'Doença cardíaca',
	'kidney-disease': 'Doença renal',
	'liver-disease': 'Doença hepática',
	'thyroid-disorder': 'Distúrbio de tireoide',
	'food-allergy-intolerance': 'Alergias/intolerâncias alimentares',
}
const GENDER_META_BY_VALUE: Record<string, PillMeta> = {
	female: {
		label: 'Feminino',
		className: 'border border-rose-200 bg-rose-50 text-rose-700',
	},
	male: {
		label: 'Masculino',
		className: 'border border-sky-200 bg-sky-50 text-sky-700',
	},
	other: {
		label: 'Outro',
		className: 'border border-violet-200 bg-violet-50 text-violet-700',
	},
}
const ACTIVITY_META_BY_VALUE: Record<string, PillMeta> = {
	sedentary: {
		label: 'Sedentário',
		className: 'border border-slate-200 bg-slate-100 text-slate-700',
	},
	light: {
		label: 'Leve',
		className: 'border border-amber-200 bg-amber-50 text-amber-700',
	},
	moderate: {
		label: 'Moderado',
		className: 'border border-cyan-200 bg-cyan-50 text-cyan-700',
	},
	intense: {
		label: 'Intenso',
		className: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
	},
	'very-intense': {
		label: 'Muito intenso',
		className: 'border border-lime-200 bg-lime-50 text-lime-700',
	},
}
const PLAN_PORTION_GROUP_LABELS = [
	'Grupo 1 - Paes, massas, batata e mandioca',
	'Grupo 2 - Verduras e legumes',
	'Grupo 3 - Frutas',
	'Grupo 4 - Leguminosas e oleaginosas',
	'Grupo 5 - Carnes, ovos e pescados',
	'Grupo 6 - Leite e derivados',
	'Grupo 7 - Oleos e gorduras',
	'Grupo 8 - Acucares e doces',
]
const MEAL_SCHEDULE_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const notificationClassNames = {
	root: NotificationStyle.root,
	title: NotificationStyle.title,
	description: NotificationStyle.description,
	icon: NotificationStyle.icon,
	closeButton: NotificationStyle.closeButton,
}

function showSuccessNotification(title: string, message: string) {
	notifications.show({
		title,
		message,
		color: 'teal',
		withBorder: true,
		autoClose: 3500,
		className: NotificationStyle.success,
		classNames: notificationClassNames,
		icon: <IoCheckmarkCircleOutline size={20} className={NotificationStyle.successGlyph} />,
	})
}

function showErrorNotification(title: string, message: string) {
	notifications.show({
		title,
		message,
		color: 'red',
		withBorder: true,
		autoClose: 4500,
		className: NotificationStyle.error,
		classNames: notificationClassNames,
		icon: <IoAlertCircleOutline size={20} className={NotificationStyle.errorGlyph} />,
	})
}

function buildApiUrl(path: string) {
	if (!API_BASE_URL) {
		return path
	}

	return `${API_BASE_URL}${path}`
}

function normalizeTextField(value: unknown) {
	if (typeof value !== 'string') {
		return ''
	}

	return value.trim().replace(/\s+/g, ' ')
}

function normalizeSearchText(value: string) {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function normalizeProfileImageSrc(profilePicture: string | null | undefined): string | null {
	if (!profilePicture) {
		return null
	}

	const normalized = profilePicture.trim()
	if (!normalized) {
		return null
	}

	if (
		normalized.startsWith('data:image/') ||
		normalized.startsWith('http://') ||
		normalized.startsWith('https://')
	) {
		return normalized
	}

	if (normalized.startsWith('/')) {
		return buildApiUrl(normalized)
	}

	return normalized
}

function convertBlobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				resolve(reader.result)
				return
			}

			reject(new Error('Falha ao converter imagem para data URL.'))
		}
		reader.onerror = () => {
			reject(new Error('Falha ao carregar imagem para o PDF.'))
		}
		reader.readAsDataURL(blob)
	})
}

function parseTacoFoodEntries(source: unknown): TacoFoodTableEntry[] {
	if (!Array.isArray(source)) {
		return []
	}

	return source.flatMap((entry): TacoFoodTableEntry[] => {
		if (typeof entry !== 'object' || entry === null) {
			return []
		}

		const rawEntry = entry as Record<string, unknown>
		const parsedId = typeof rawEntry.id === 'number' ? rawEntry.id : Number.NaN
		const description = typeof rawEntry.description === 'string' ? rawEntry.description.trim() : ''

		if (!Number.isFinite(parsedId) || description.length === 0) {
			return []
		}

		return [{
			id: parsedId,
			description,
			category: typeof rawEntry.category === 'string' ? rawEntry.category.trim() : '',
			energy_kcal: rawEntry.energy_kcal,
			carbohydrate_g: rawEntry.carbohydrate_g,
			protein_g: rawEntry.protein_g,
			lipid_g: rawEntry.lipid_g,
			fiber_g: rawEntry.fiber_g,
			cholesterol_mg: rawEntry.cholesterol_mg,
			iron_mg: rawEntry.iron_mg,
			magnesium_mg: rawEntry.magnesium_mg,
			phosphorus_mg: rawEntry.phosphorus_mg,
			sodium_mg: rawEntry.sodium_mg,
			potassium_mg: rawEntry.potassium_mg,
			saturated_g: rawEntry.saturated_g,
			monounsaturated_g: rawEntry.monounsaturated_g,
			polyunsaturated_g: rawEntry.polyunsaturated_g,
			'18:1t_g': rawEntry['18:1t_g'],
			'18:2t_g': rawEntry['18:2t_g'],
			vitaminC_mg: rawEntry.vitaminC_mg,
			thiamine_mg: rawEntry.thiamine_mg,
			riboflavin_mg: rawEntry.riboflavin_mg,
			niacin_mg: rawEntry.niacin_mg,
			pyridoxine_mg: rawEntry.pyridoxine_mg,
			retinol_mcg: rawEntry.retinol_mcg,
			rae_mcg: rawEntry.rae_mcg,
			calcium_mg: rawEntry.calcium_mg,
			manganese_mg: rawEntry.manganese_mg,
			zinc_mg: rawEntry.zinc_mg,
		}]
	})
}

function parsePlanNumericValue(value: unknown) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value
	}

	if (typeof value !== 'string') {
		return 0
	}

	const normalizedValue = value.trim().toLowerCase()
	if (!normalizedValue || normalizedValue === 'na' || normalizedValue === 'nd' || normalizedValue === 'tr') {
		return 0
	}

	const parsedValue = Number.parseFloat(normalizedValue.replace(',', '.'))
	return Number.isFinite(parsedValue) ? parsedValue : 0
}

function parsePositiveAmountFromText(value: string) {
	const normalizedValue = value.trim().replace(',', '.')
	if (!normalizedValue) {
		return null
	}

	const parsedValue = Number.parseFloat(normalizedValue)
	if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
		return null
	}

	return parsedValue
}

function estimateAmountInGrams(quantity: string, measure: string) {
	const quantityValue = parsePositiveAmountFromText(quantity) ?? 1
	const normalizedMeasure = normalizeSearchText(measure)
	if (!normalizedMeasure) {
		return quantityValue * 100
	}

	const measureTokens = normalizedMeasure.split(' ').filter((token) => token.length > 0)
	const hasToken = (token: string) => measureTokens.includes(token)

	if (hasToken('kg') || measureTokens.includes('quilograma') || measureTokens.includes('quilogramas')) {
		return quantityValue * 1000
	}

	if (hasToken('mg') || measureTokens.includes('miligrama') || measureTokens.includes('miligramas')) {
		return quantityValue / 1000
	}

	if (hasToken('g') || measureTokens.includes('grama') || measureTokens.includes('gramas')) {
		return quantityValue
	}

	if (hasToken('ml') || measureTokens.includes('mililitro') || measureTokens.includes('mililitros')) {
		return quantityValue
	}

	if (hasToken('l') || measureTokens.includes('litro') || measureTokens.includes('litros')) {
		return quantityValue * 1000
	}

	if (measureTokens.includes('colher') && measureTokens.includes('sopa')) {
		return quantityValue * 15
	}

	if (measureTokens.includes('colher') && (measureTokens.includes('cha') || measureTokens.includes('te'))) {
		return quantityValue * 5
	}

	if (measureTokens.includes('xicara') || measureTokens.includes('xic') || measureTokens.includes('copo')) {
		return quantityValue * 200
	}

	if (measureTokens.includes('fatia') || measureTokens.includes('fatias')) {
		return quantityValue * 30
	}

	if (measureTokens.includes('unidade') || measureTokens.includes('unidades') || hasToken('un')) {
		return quantityValue * 80
	}

	if (measureTokens.includes('porcao') || measureTokens.includes('porcoes')) {
		return quantityValue * 100
	}

	return quantityValue * 100
}

function resolvePlanPortionGroupIndex(foodEntry: TacoFoodTableEntry) {
	const normalizedCategory = normalizeSearchText(foodEntry.category)
	const normalizedDescription = normalizeSearchText(foodEntry.description)

	if (normalizedCategory.includes('produtos acucarados')) {
		return 7
	}

	if (normalizedCategory.includes('gorduras e oleos')) {
		return 6
	}

	if (normalizedCategory.includes('leite e derivados')) {
		return 5
	}

	if (
		normalizedCategory.includes('carnes e derivados') ||
		normalizedCategory.includes('ovos e derivados') ||
		normalizedCategory.includes('pescados e frutos do mar')
	) {
		return 4
	}

	if (
		normalizedCategory.includes('leguminosas e derivados') ||
		normalizedCategory.includes('nozes e sementes')
	) {
		return 3
	}

	if (normalizedCategory.includes('frutas e derivados')) {
		return 2
	}

	if (normalizedCategory.includes('verduras hortalicas e derivados')) {
		return 1
	}

	if (normalizedCategory.includes('cereais e derivados')) {
		return 0
	}

	if (normalizedDescription.includes('acucar') || normalizedDescription.includes('doce') || normalizedDescription.includes('chocolate')) {
		return 7
	}

	if (
		normalizedDescription.includes('oleo') ||
		normalizedDescription.includes('azeite') ||
		normalizedDescription.includes('manteiga') ||
		normalizedDescription.includes('margarina')
	) {
		return 6
	}

	if (
		normalizedDescription.includes('leite') ||
		normalizedDescription.includes('iogurte') ||
		normalizedDescription.includes('queijo')
	) {
		return 5
	}

	if (
		normalizedDescription.includes('frango') ||
		normalizedDescription.includes('carne') ||
		normalizedDescription.includes('peixe') ||
		normalizedDescription.includes('ovo')
	) {
		return 4
	}

	if (
		normalizedDescription.includes('feijao') ||
		normalizedDescription.includes('lentilha') ||
		normalizedDescription.includes('grao de bico') ||
		normalizedDescription.includes('castanha') ||
		normalizedDescription.includes('amendoim')
	) {
		return 3
	}

	if (normalizedDescription.includes('fruta')) {
		return 2
	}

	if (
		normalizedDescription.includes('alface') ||
		normalizedDescription.includes('couve') ||
		normalizedDescription.includes('brocolis') ||
		normalizedDescription.includes('cenoura') ||
		normalizedDescription.includes('tomate')
	) {
		return 1
	}

	if (
		normalizedDescription.includes('pao') ||
		normalizedDescription.includes('arroz') ||
		normalizedDescription.includes('macarrao') ||
		normalizedDescription.includes('massa') ||
		normalizedDescription.includes('batata') ||
		normalizedDescription.includes('mandioca')
	) {
		return 0
	}

	return null
}

function resolveDistributionSchedule(groupName: string, groupIndex: number) {
	const normalizedGroupName = normalizeSearchText(groupName)

	if (normalizedGroupName.includes('cafe da manha')) {
		return '07:00'
	}

	if (normalizedGroupName.includes('lanche da manha') || normalizedGroupName.includes('colacao')) {
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

function normalizeMealScheduleTime(value: unknown) {
	if (typeof value !== 'string') {
		return ''
	}

	const normalizedValue = value.trim()
	return MEAL_SCHEDULE_TIME_PATTERN.test(normalizedValue) ? normalizedValue : ''
}

function resolveMealScheduleLabel(
	scheduleTime: string,
	groupName: string,
	groupIndex: number,
) {
	const normalizedScheduleTime = normalizeMealScheduleTime(scheduleTime)
	if (normalizedScheduleTime.length > 0) {
		return normalizedScheduleTime
	}

	return resolveDistributionSchedule(groupName, groupIndex)
}

function formatPlanPreviewNumber(value: number, decimals: number) {
	return value.toLocaleString('pt-BR', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	})
}

function formatPlanReferenceValue(value: number | null, decimals: number) {
	if (value === null) {
		return 'ND'
	}

	return formatPlanPreviewNumber(value, decimals)
}

function classifyMicronutrientAdequacy(value: number, ear: number | null, rdaOrAi: number | null, ul: number | null) {
	if (ul !== null && value > ul) {
		return 'Acima do limite'
	}

	if (rdaOrAi !== null && value >= rdaOrAi) {
		return 'Adequado'
	}

	if (ear !== null && value >= ear) {
		return 'Parcial'
	}

	if (value > 0) {
		return 'Parcial'
	}

	return 'Baixo'
}

function classifyRangeAdequacy(value: number, minimum: number, maximum: number) {
	if (value < minimum) {
		return 'Abaixo'
	}

	if (value > maximum) {
		return 'Acima'
	}

	return 'Adequado'
}

function classifyThresholdAdequacy(value: number, minimum: number) {
	return value >= minimum ? 'Adequado' : 'Abaixo'
}

function clampPlanPercentage(value: number) {
	if (!Number.isFinite(value) || value <= 0) {
		return 0
	}

	return Math.min(Math.max(value, 0), 100)
}

function buildPlanInfographicRow(
	nutrientLabel: string,
	value: number,
	unit: string,
	referenceValue: number | null,
	referenceKind: 'minimum' | 'maximum' | 'none',
): MealPlanPdfNutritionPreviewData['infographicRows'][number] {
	const safeValue = Number.isFinite(value) ? value : 0
	if (referenceValue === null || referenceKind === 'none' || !Number.isFinite(referenceValue) || referenceValue <= 0) {
		return {
			nutrientLabel,
			value: safeValue,
			unit,
			referenceValue: null,
			referenceLabel: 'ND',
			referenceKind: 'none',
			barPercentage: 0,
			isPositive: false,
		}
	}

	const ratio = safeValue / referenceValue
	const barPercentage = clampPlanPercentage(ratio * 100)
	const isPositive = referenceKind === 'minimum'
		? safeValue >= referenceValue
		: safeValue <= referenceValue
	const comparator = referenceKind === 'minimum' ? '>=' : '<='
	const decimals = unit === 'mcg'
		? 0
		: unit === 'mg'
			? (referenceValue < 10 ? 1 : 0)
			: 1

	return {
		nutrientLabel,
		value: safeValue,
		unit,
		referenceValue,
		referenceLabel: `${comparator} ${formatPlanPreviewNumber(referenceValue, decimals)} ${unit}`,
		referenceKind,
		barPercentage,
		isPositive,
	}
}

function buildPlanNutritionPreviewData(
	mealGroups: SavedPatientMenuMealGroupResponse[],
	tacoFoodById: Map<string, TacoFoodTableEntry>,
	patientGender: string,
): MealPlanPdfNutritionPreviewData {
	const isFemale = normalizeSearchText(patientGender).includes('female')
	const portionTotals = PLAN_PORTION_GROUP_LABELS.map(() => 0)
	const mealDistributionAccumulator = mealGroups.map(() => ({
		proteinG: 0,
		carbohydrateG: 0,
		lipidG: 0,
		caloriesKcal: 0,
		quantityG: 0,
	}))

	let totalPlanKcal = 0
	let totalCarbohydrateG = 0
	let totalProteinG = 0
	let totalLipidG = 0
	let totalQuantityG = 0
	let totalFiberG = 0
	let totalCholesterolMg = 0
	let totalIronMg = 0
	let totalMagnesiumMg = 0
	let totalPhosphorusMg = 0
	let totalSodiumMg = 0
	let totalPotassiumMg = 0
	let totalSaturatedG = 0
	let totalMonounsaturatedG = 0
	let totalPolyunsaturatedG = 0
	let totalTransG = 0
	let totalVitaminCMg = 0
	let totalThiamineMg = 0
	let totalRiboflavinMg = 0
	let totalNiacinMg = 0
	let totalPyridoxineMg = 0
	let totalVitaminAMcg = 0
	let totalCalciumMg = 0
	let totalManganeseMg = 0
	let totalZincMg = 0
	let totalMappedFoodsCount = 0
	let estimatedItemsCount = 0

	for (const [groupIndex, group] of mealGroups.entries()) {
		for (const item of group.items) {
			if (!item.foodId) {
				continue
			}

			const tacoFood = tacoFoodById.get(item.foodId)
			if (!tacoFood) {
				continue
			}

			totalMappedFoodsCount += 1

			const estimatedPortion = parsePositiveAmountFromText(item.quantity) ?? 1
			const portionGroupIndex = resolvePlanPortionGroupIndex(tacoFood)
			if (portionGroupIndex !== null) {
				portionTotals[portionGroupIndex] += estimatedPortion
			}

			const estimatedGrams = estimateAmountInGrams(item.quantity, item.measure)
			const conversionFactor = estimatedGrams / 100
			if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
				continue
			}

			estimatedItemsCount += 1

			const retinolMcg = parsePlanNumericValue(tacoFood.retinol_mcg)
			const raeMcg = parsePlanNumericValue(tacoFood.rae_mcg)
			const itemCaloriesKcal = parsePlanNumericValue(tacoFood.energy_kcal) * conversionFactor
			const itemCarbohydrateG = parsePlanNumericValue(tacoFood.carbohydrate_g) * conversionFactor
			const itemProteinG = parsePlanNumericValue(tacoFood.protein_g) * conversionFactor
			const itemLipidG = parsePlanNumericValue(tacoFood.lipid_g) * conversionFactor

			totalPlanKcal += itemCaloriesKcal
			totalCarbohydrateG += itemCarbohydrateG
			totalProteinG += itemProteinG
			totalLipidG += itemLipidG
			totalQuantityG += estimatedGrams
			totalFiberG += parsePlanNumericValue(tacoFood.fiber_g) * conversionFactor
			totalCholesterolMg += parsePlanNumericValue(tacoFood.cholesterol_mg) * conversionFactor
			totalIronMg += parsePlanNumericValue(tacoFood.iron_mg) * conversionFactor
			totalMagnesiumMg += parsePlanNumericValue(tacoFood.magnesium_mg) * conversionFactor
			totalPhosphorusMg += parsePlanNumericValue(tacoFood.phosphorus_mg) * conversionFactor
			totalSodiumMg += parsePlanNumericValue(tacoFood.sodium_mg) * conversionFactor
			totalPotassiumMg += parsePlanNumericValue(tacoFood.potassium_mg) * conversionFactor
			totalSaturatedG += parsePlanNumericValue(tacoFood.saturated_g) * conversionFactor
			totalMonounsaturatedG += parsePlanNumericValue(tacoFood.monounsaturated_g) * conversionFactor
			totalPolyunsaturatedG += parsePlanNumericValue(tacoFood.polyunsaturated_g) * conversionFactor
			totalTransG += (parsePlanNumericValue(tacoFood['18:1t_g']) + parsePlanNumericValue(tacoFood['18:2t_g'])) * conversionFactor
			totalVitaminCMg += parsePlanNumericValue(tacoFood.vitaminC_mg) * conversionFactor
			totalThiamineMg += parsePlanNumericValue(tacoFood.thiamine_mg) * conversionFactor
			totalRiboflavinMg += parsePlanNumericValue(tacoFood.riboflavin_mg) * conversionFactor
			totalNiacinMg += parsePlanNumericValue(tacoFood.niacin_mg) * conversionFactor
			totalPyridoxineMg += parsePlanNumericValue(tacoFood.pyridoxine_mg) * conversionFactor
			totalVitaminAMcg += Math.max(raeMcg, retinolMcg) * conversionFactor
			totalCalciumMg += parsePlanNumericValue(tacoFood.calcium_mg) * conversionFactor
			totalManganeseMg += parsePlanNumericValue(tacoFood.manganese_mg) * conversionFactor
			totalZincMg += parsePlanNumericValue(tacoFood.zinc_mg) * conversionFactor

			const distributionAccumulator = mealDistributionAccumulator[groupIndex]
			if (distributionAccumulator) {
				distributionAccumulator.caloriesKcal += itemCaloriesKcal
				distributionAccumulator.carbohydrateG += itemCarbohydrateG
				distributionAccumulator.proteinG += itemProteinG
				distributionAccumulator.lipidG += itemLipidG
				distributionAccumulator.quantityG += estimatedGrams
			}
		}
	}

	const micronutrientReferences = {
		vitaminC: {
			ear: isFemale ? 60 : 75,
			rdaOrAi: isFemale ? 75 : 90,
			ul: 2000,
			decimals: 0,
			unit: 'mg',
		},
		thiamine: {
			ear: isFemale ? 0.9 : 1.0,
			rdaOrAi: isFemale ? 1.1 : 1.2,
			ul: null,
			decimals: 1,
			unit: 'mg',
		},
		vitaminA: {
			ear: isFemale ? 500 : 625,
			rdaOrAi: isFemale ? 700 : 900,
			ul: 3000,
			decimals: 0,
			unit: 'mcg',
		},
		calcium: {
			ear: 800,
			rdaOrAi: 1000,
			ul: 2500,
			decimals: 0,
			unit: 'mg',
		},
		manganese: {
			ear: null,
			rdaOrAi: isFemale ? 1.8 : 2.3,
			ul: 11,
			decimals: 1,
			unit: 'mg',
		},
		zinc: {
			ear: isFemale ? 6.8 : 9.4,
			rdaOrAi: isFemale ? 8 : 11,
			ul: 40,
			decimals: 1,
			unit: 'mg',
		},
	}

	const micronutrientRows = [
		{
			nutrientLabel: `Vitamina C (${micronutrientReferences.vitaminC.unit})`,
			offeredLabel: `${formatPlanPreviewNumber(totalVitaminCMg, 1)} ${micronutrientReferences.vitaminC.unit}`,
			earLabel: formatPlanReferenceValue(micronutrientReferences.vitaminC.ear, micronutrientReferences.vitaminC.decimals),
			rdaOrAiLabel: formatPlanReferenceValue(micronutrientReferences.vitaminC.rdaOrAi, micronutrientReferences.vitaminC.decimals),
			ulLabel: formatPlanReferenceValue(micronutrientReferences.vitaminC.ul, micronutrientReferences.vitaminC.decimals),
			analysis: classifyMicronutrientAdequacy(
				totalVitaminCMg,
				micronutrientReferences.vitaminC.ear,
				micronutrientReferences.vitaminC.rdaOrAi,
				micronutrientReferences.vitaminC.ul,
			),
		},
		{
			nutrientLabel: `Vitamina B1 (${micronutrientReferences.thiamine.unit})`,
			offeredLabel: `${formatPlanPreviewNumber(totalThiamineMg, 2)} ${micronutrientReferences.thiamine.unit}`,
			earLabel: formatPlanReferenceValue(micronutrientReferences.thiamine.ear, micronutrientReferences.thiamine.decimals),
			rdaOrAiLabel: formatPlanReferenceValue(micronutrientReferences.thiamine.rdaOrAi, micronutrientReferences.thiamine.decimals),
			ulLabel: formatPlanReferenceValue(micronutrientReferences.thiamine.ul, micronutrientReferences.thiamine.decimals),
			analysis: classifyMicronutrientAdequacy(
				totalThiamineMg,
				micronutrientReferences.thiamine.ear,
				micronutrientReferences.thiamine.rdaOrAi,
				micronutrientReferences.thiamine.ul,
			),
		},
		{
			nutrientLabel: `Vitamina A (${micronutrientReferences.vitaminA.unit})`,
			offeredLabel: `${formatPlanPreviewNumber(totalVitaminAMcg, 0)} ${micronutrientReferences.vitaminA.unit}`,
			earLabel: formatPlanReferenceValue(micronutrientReferences.vitaminA.ear, micronutrientReferences.vitaminA.decimals),
			rdaOrAiLabel: formatPlanReferenceValue(micronutrientReferences.vitaminA.rdaOrAi, micronutrientReferences.vitaminA.decimals),
			ulLabel: formatPlanReferenceValue(micronutrientReferences.vitaminA.ul, micronutrientReferences.vitaminA.decimals),
			analysis: classifyMicronutrientAdequacy(
				totalVitaminAMcg,
				micronutrientReferences.vitaminA.ear,
				micronutrientReferences.vitaminA.rdaOrAi,
				micronutrientReferences.vitaminA.ul,
			),
		},
		{
			nutrientLabel: `Calcio (${micronutrientReferences.calcium.unit})`,
			offeredLabel: `${formatPlanPreviewNumber(totalCalciumMg, 0)} ${micronutrientReferences.calcium.unit}`,
			earLabel: formatPlanReferenceValue(micronutrientReferences.calcium.ear, micronutrientReferences.calcium.decimals),
			rdaOrAiLabel: formatPlanReferenceValue(micronutrientReferences.calcium.rdaOrAi, micronutrientReferences.calcium.decimals),
			ulLabel: formatPlanReferenceValue(micronutrientReferences.calcium.ul, micronutrientReferences.calcium.decimals),
			analysis: classifyMicronutrientAdequacy(
				totalCalciumMg,
				micronutrientReferences.calcium.ear,
				micronutrientReferences.calcium.rdaOrAi,
				micronutrientReferences.calcium.ul,
			),
		},
		{
			nutrientLabel: `Manganes (${micronutrientReferences.manganese.unit})`,
			offeredLabel: `${formatPlanPreviewNumber(totalManganeseMg, 2)} ${micronutrientReferences.manganese.unit}`,
			earLabel: formatPlanReferenceValue(micronutrientReferences.manganese.ear, micronutrientReferences.manganese.decimals),
			rdaOrAiLabel: formatPlanReferenceValue(micronutrientReferences.manganese.rdaOrAi, micronutrientReferences.manganese.decimals),
			ulLabel: formatPlanReferenceValue(micronutrientReferences.manganese.ul, micronutrientReferences.manganese.decimals),
			analysis: classifyMicronutrientAdequacy(
				totalManganeseMg,
				micronutrientReferences.manganese.ear,
				micronutrientReferences.manganese.rdaOrAi,
				micronutrientReferences.manganese.ul,
			),
		},
		{
			nutrientLabel: `Zinco (${micronutrientReferences.zinc.unit})`,
			offeredLabel: `${formatPlanPreviewNumber(totalZincMg, 2)} ${micronutrientReferences.zinc.unit}`,
			earLabel: formatPlanReferenceValue(micronutrientReferences.zinc.ear, micronutrientReferences.zinc.decimals),
			rdaOrAiLabel: formatPlanReferenceValue(micronutrientReferences.zinc.rdaOrAi, micronutrientReferences.zinc.decimals),
			ulLabel: formatPlanReferenceValue(micronutrientReferences.zinc.ul, micronutrientReferences.zinc.decimals),
			analysis: classifyMicronutrientAdequacy(
				totalZincMg,
				micronutrientReferences.zinc.ear,
				micronutrientReferences.zinc.rdaOrAi,
				micronutrientReferences.zinc.ul,
			),
		},
	]

	const totalMacroEnergyKcal = (totalCarbohydrateG * 4) + (totalProteinG * 4) + (totalLipidG * 9)
	const hasMacroEnergyData = totalMacroEnergyKcal > 0
	const carbohydratePercentage = hasMacroEnergyData ? (totalCarbohydrateG * 4 * 100) / totalMacroEnergyKcal : 0
	const proteinPercentage = hasMacroEnergyData ? (totalProteinG * 4 * 100) / totalMacroEnergyKcal : 0
	const lipidPercentage = hasMacroEnergyData ? (totalLipidG * 9 * 100) / totalMacroEnergyKcal : 0

	const macronutrientRows = [
		{
			nutrientLabel: 'Fibras',
			offeredLabel: `${formatPlanPreviewNumber(totalFiberG, 1)} g`,
			recommendedLabel: 'AI >= 25 g',
			analysis: classifyThresholdAdequacy(totalFiberG, 25),
		},
		{
			nutrientLabel: 'CHO (%)',
			offeredLabel: `${formatPlanPreviewNumber(carbohydratePercentage, 1)}% | ${formatPlanPreviewNumber(totalCarbohydrateG, 1)} g`,
			recommendedLabel: '45 - 65',
			analysis: hasMacroEnergyData ? classifyRangeAdequacy(carbohydratePercentage, 45, 65) : 'Sem dados',
		},
		{
			nutrientLabel: 'PTN (%)',
			offeredLabel: `${formatPlanPreviewNumber(proteinPercentage, 1)}% | ${formatPlanPreviewNumber(totalProteinG, 1)} g`,
			recommendedLabel: '10 - 35',
			analysis: hasMacroEnergyData ? classifyRangeAdequacy(proteinPercentage, 10, 35) : 'Sem dados',
		},
		{
			nutrientLabel: 'LIP (%)',
			offeredLabel: `${formatPlanPreviewNumber(lipidPercentage, 1)}% | ${formatPlanPreviewNumber(totalLipidG, 1)} g`,
			recommendedLabel: '20 - 35',
			analysis: hasMacroEnergyData ? classifyRangeAdequacy(lipidPercentage, 20, 35) : 'Sem dados',
		},
	]

	const mealDistributionRows = mealGroups.map((group, groupIndex) => {
		const groupName = normalizeTextField(group.name) || `Refeicao ${groupIndex + 1}`
		const distributionTotals = mealDistributionAccumulator[groupIndex] ?? {
			proteinG: 0,
			carbohydrateG: 0,
			lipidG: 0,
			caloriesKcal: 0,
			quantityG: 0,
		}

		return {
			scheduleLabel: resolveMealScheduleLabel(group.scheduleTime, groupName, groupIndex),
			mealLabel: groupName,
			proteinG: distributionTotals.proteinG,
			carbohydrateG: distributionTotals.carbohydrateG,
			lipidG: distributionTotals.lipidG,
			caloriesKcal: distributionTotals.caloriesKcal,
			quantityG: distributionTotals.quantityG,
		}
	})

	const infographicRows = [
		buildPlanInfographicRow('Calcio', totalCalciumMg, 'mg', 1000, 'minimum'),
		buildPlanInfographicRow('Colesterol', totalCholesterolMg, 'mg', 300, 'maximum'),
		buildPlanInfographicRow('Ferro', totalIronMg, 'mg', isFemale ? 18 : 8, 'minimum'),
		buildPlanInfographicRow('Fibra alimentar', totalFiberG, 'g', 25, 'minimum'),
		buildPlanInfographicRow('Fosforo (P)', totalPhosphorusMg, 'mg', 700, 'minimum'),
		buildPlanInfographicRow('G. monoinsaturada', totalMonounsaturatedG, 'g', null, 'none'),
		buildPlanInfographicRow('G. poli-insaturada', totalPolyunsaturatedG, 'g', null, 'none'),
		buildPlanInfographicRow('G. saturada', totalSaturatedG, 'g', 22, 'maximum'),
		buildPlanInfographicRow('G. trans', totalTransG, 'g', 2, 'maximum'),
		buildPlanInfographicRow('Magnesio', totalMagnesiumMg, 'mg', isFemale ? 320 : 400, 'minimum'),
		buildPlanInfographicRow('Manganes', totalManganeseMg, 'mg', isFemale ? 1.8 : 2.3, 'minimum'),
		buildPlanInfographicRow('Potassio', totalPotassiumMg, 'mg', 4700, 'minimum'),
		buildPlanInfographicRow('Sodio', totalSodiumMg, 'mg', 2300, 'maximum'),
		buildPlanInfographicRow('Vitamina A (Retinol)', totalVitaminAMcg, 'mcg', isFemale ? 700 : 900, 'minimum'),
		buildPlanInfographicRow('Vitamina B1 (Tiamina)', totalThiamineMg, 'mg', isFemale ? 1.1 : 1.2, 'minimum'),
		buildPlanInfographicRow('Vitamina B2 (Riboflavina)', totalRiboflavinMg, 'mg', isFemale ? 1.1 : 1.3, 'minimum'),
		buildPlanInfographicRow('Vitamina B3 (Niacina)', totalNiacinMg, 'mg', isFemale ? 14 : 16, 'minimum'),
		buildPlanInfographicRow('Vitamina B6 (Piridoxina)', totalPyridoxineMg, 'mg', isFemale ? 1.3 : 1.3, 'minimum'),
		buildPlanInfographicRow('Vitamina C', totalVitaminCMg, 'mg', isFemale ? 75 : 90, 'minimum'),
		buildPlanInfographicRow('Zinco', totalZincMg, 'mg', isFemale ? 8 : 11, 'minimum'),
	]

	return {
		portionRows: PLAN_PORTION_GROUP_LABELS.map((groupName, groupIndex) => ({
			groupName,
			portions: portionTotals[groupIndex],
		})),
		totalPlanKcal,
		totalProteinG,
		totalCarbohydrateG,
		totalLipidG,
		totalQuantityG,
		totalMappedFoodsCount,
		estimatedItemsCount,
		micronutrientRows,
		macronutrientRows,
		mealDistributionRows,
		infographicRows,
	}
}

function ensureGuidanceSentence(value: string) {
	const normalizedValue = normalizeTextField(value)
	if (normalizedValue.length === 0) {
		return ''
	}

	return /[.!?]$/.test(normalizedValue) ? normalizedValue : `${normalizedValue}.`
}

function buildNutritionGuidanceTips(
	patient: PatientDetailsResponse,
	guidance: SavedPatientMenuNutritionGuidanceResponse,
	aiHighlights: string[],
) {
	const tips: string[] = []
	const hydrationGoalMl = guidance.hydrationGoalMl ?? (Number.isFinite(patient.weight) ? Math.round(patient.weight * 35) : null)

	if (hydrationGoalMl !== null) {
		tips.push(`Mantenha hidratacao regular ao longo do dia (meta aproximada: ${hydrationGoalMl} ml/dia).`)
	}

	for (const highlight of aiHighlights) {
		const normalizedHighlight = ensureGuidanceSentence(highlight)
		if (normalizedHighlight.length > 0) {
			tips.push(normalizedHighlight)
		}
	}

	const guidanceFieldTips: Array<{ label: string; value: string }> = [
		{ label: 'Rotina das refeicoes', value: guidance.mealRoutineGuidance },
		{ label: 'Qualidade alimentar', value: guidance.foodQualityGuidance },
		{ label: 'Preparo e organizacao', value: guidance.preparationGuidance },
		{ label: 'Comportamento alimentar', value: guidance.behaviorGuidance },
		{ label: 'Monitoramento de sintomas', value: guidance.symptomMonitoringGuidance },
		{ label: 'Restricoes e alertas', value: guidance.restrictionsGuidance },
		{ label: 'Orientacoes adicionais', value: guidance.additionalGuidance },
	]

	for (const fieldTip of guidanceFieldTips) {
		const sentence = ensureGuidanceSentence(fieldTip.value)
		if (sentence.length === 0) {
			continue
		}

		tips.push(`${fieldTip.label}: ${sentence}`)
	}

	const uniqueTips = Array.from(new Set(tips.map((tip) => normalizeTextField(tip)).filter((tip) => tip.length > 0)))
	if (uniqueTips.length > 0) {
		return uniqueTips
	}

	return [
		'Mantenha hidratacao regular e fracionada ao longo do dia.',
		'Priorize alimentos in natura e mantenha rotina de refeicoes consistente.',
		'Monitore sua resposta clinica e ajuste com acompanhamento nutricional periodico.',
	]
}

function toStartCase(value: string) {
	return value
		.trim()
		.replace(/[-_]+/g, ' ')
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

function formatDate(dateValue: string) {
	const parsedDate = new Date(dateValue)
	if (Number.isNaN(parsedDate.getTime())) {
		return '-'
	}

	return parsedDate.toLocaleDateString('pt-BR')
}

function formatDateTime(dateValue: string) {
	const parsedDate = new Date(dateValue)
	if (Number.isNaN(parsedDate.getTime())) {
		return '-'
	}

	return `${parsedDate.toLocaleDateString('pt-BR')} às ${parsedDate.toLocaleTimeString('pt-BR', {
		hour: '2-digit',
		minute: '2-digit',
	})}`
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
	if (gender === 'female') {
		return 'Feminino'
	}

	if (gender === 'male') {
		return 'Masculino'
	}

	return 'Outro'
}

function formatActivityLevel(activityLevel: string) {
	const labels: Record<string, string> = {
		sedentary: 'Sedentário',
		light: 'Leve',
		moderate: 'Moderado',
		intense: 'Intenso',
		'very-intense': 'Muito intenso',
	}

	return labels[activityLevel] ?? toStartCase(activityLevel)
}

function getGenderMeta(gender: string): PillMeta {
	const mappedGender = GENDER_META_BY_VALUE[gender]
	if (mappedGender) {
		return mappedGender
	}

	return {
		label: formatGender(gender),
		className: DEFAULT_PILL_CLASS,
	}
}

function getActivityMeta(activityLevel: string): PillMeta {
	const mappedActivity = ACTIVITY_META_BY_VALUE[activityLevel]
	if (mappedActivity) {
		return mappedActivity
	}

	return {
		label: formatActivityLevel(activityLevel),
		className: DEFAULT_PILL_CLASS,
	}
}

function formatGoal(goal: string) {
	const normalizedGoal = goal.trim().toLowerCase()
	if (!normalizedGoal) {
		return ''
	}

	return GOAL_LABELS[normalizedGoal] ?? toStartCase(normalizedGoal)
}

function parseGoalTags(goalList: string) {
	return goalList
		.split(',')
		.map((goal) => formatGoal(goal))
		.filter((goal) => goal.length > 0)
}

function formatMedicalCondition(condition: string) {
	const normalizedCondition = condition.trim().toLowerCase()
	if (!normalizedCondition) {
		return ''
	}

	return MEDICAL_CONDITION_LABELS[normalizedCondition] ?? toStartCase(normalizedCondition)
}

function formatMetric(value: number, unit: string, decimals = 1) {
	if (!Number.isFinite(value)) {
		return '-'
	}

	return `${value.toFixed(decimals)} ${unit}`
}

function formatOptionalMetric(value: number, unit: string, decimals = 1) {
	if (!Number.isFinite(value) || value <= 0) {
		return '-'
	}

	return `${value.toFixed(decimals)} ${unit}`
}

function formatDataEntryStep(step: number) {
	if (step <= 0) {
		return 'Itens do plano'
	}

	if (step === 1) {
		return 'Orientações'
	}

	if (step === 2) {
		return 'Receitas'
	}

	return `Etapa ${step + 1}`
}

function summarizeSavedMenu(savedMenu: SavedPatientMenuResponse): SavedPatientMenuSummary {
	const mealGroups = Array.isArray(savedMenu.mealGroups) ? savedMenu.mealGroups : []
	const recipeSuggestions = Array.isArray(savedMenu.recipeSuggestions) ? savedMenu.recipeSuggestions : []
	const mealItemsCount = mealGroups.reduce((totalItems, mealGroup) => {
		const mealItems = Array.isArray(mealGroup.items) ? mealGroup.items : []
		return totalItems + mealItems.length
	}, 0)

	return {
		id: savedMenu.id,
		activeDataEntryStep: Number.isFinite(savedMenu.activeDataEntryStep) ? savedMenu.activeDataEntryStep : 0,
		mealGroupsCount: mealGroups.length,
		mealItemsCount,
		recipeSuggestionsCount: recipeSuggestions.length,
		createdAt: savedMenu.createdAt,
		updatedAt: savedMenu.updatedAt,
		source: savedMenu,
	}
}

function triggerLocalDownload(url: string, fileName: string) {
	const downloadAnchor = document.createElement('a')
	downloadAnchor.href = url
	downloadAnchor.download = fileName
	downloadAnchor.rel = 'noopener'
	document.body.appendChild(downloadAnchor)
	downloadAnchor.click()
	document.body.removeChild(downloadAnchor)
}

function normalizeSavedMenuResponse(savedMenu: SavedPatientMenuResponse): SavedPatientMenuResponse {
	const normalizedMealGroups = Array.isArray(savedMenu.mealGroups)
		? savedMenu.mealGroups.map((mealGroup) => ({
			id: typeof mealGroup.id === 'string' ? mealGroup.id : '',
			name: typeof mealGroup.name === 'string' ? mealGroup.name : '',
			scheduleTime: normalizeMealScheduleTime(mealGroup.scheduleTime),
			items: Array.isArray(mealGroup.items)
				? mealGroup.items.map((mealItem) => ({
					id: typeof mealItem.id === 'string' ? mealItem.id : '',
					foodId: typeof mealItem.foodId === 'string' && mealItem.foodId.trim().length > 0 ? mealItem.foodId : null,
					food: typeof mealItem.food === 'string' ? mealItem.food : '',
					quantity: typeof mealItem.quantity === 'string' ? mealItem.quantity : '',
					measure: typeof mealItem.measure === 'string' ? mealItem.measure : '',
					notes: typeof mealItem.notes === 'string' ? mealItem.notes : '',
				}))
				: [],
		}))
		: []

	const normalizedRecipeSuggestions = Array.isArray(savedMenu.recipeSuggestions)
		? savedMenu.recipeSuggestions.map((recipeSuggestion) => ({
			id: typeof recipeSuggestion.id === 'string' ? recipeSuggestion.id : '',
			recipeName: typeof recipeSuggestion.recipeName === 'string' ? recipeSuggestion.recipeName : '',
			basedOnFoods: typeof recipeSuggestion.basedOnFoods === 'string' ? recipeSuggestion.basedOnFoods : '',
			ingredients: typeof recipeSuggestion.ingredients === 'string' ? recipeSuggestion.ingredients : '',
			preparationMethod: typeof recipeSuggestion.preparationMethod === 'string' ? recipeSuggestion.preparationMethod : '',
			yieldInfo: typeof recipeSuggestion.yieldInfo === 'string' ? recipeSuggestion.yieldInfo : '',
			portionQuantity: typeof recipeSuggestion.portionQuantity === 'string' ? recipeSuggestion.portionQuantity : '',
		}))
		: []

	const rawNutritionGuidance = savedMenu.nutritionGuidance
	const normalizedNutritionGuidance: SavedPatientMenuNutritionGuidanceResponse = {
		hydrationGoalMl: typeof rawNutritionGuidance?.hydrationGoalMl === 'number'
			&& Number.isFinite(rawNutritionGuidance.hydrationGoalMl)
			&& rawNutritionGuidance.hydrationGoalMl > 0
			? Math.round(rawNutritionGuidance.hydrationGoalMl)
			: null,
		mealRoutineGuidance: typeof rawNutritionGuidance?.mealRoutineGuidance === 'string' ? rawNutritionGuidance.mealRoutineGuidance : '',
		foodQualityGuidance: typeof rawNutritionGuidance?.foodQualityGuidance === 'string' ? rawNutritionGuidance.foodQualityGuidance : '',
		preparationGuidance: typeof rawNutritionGuidance?.preparationGuidance === 'string' ? rawNutritionGuidance.preparationGuidance : '',
		behaviorGuidance: typeof rawNutritionGuidance?.behaviorGuidance === 'string' ? rawNutritionGuidance.behaviorGuidance : '',
		symptomMonitoringGuidance: typeof rawNutritionGuidance?.symptomMonitoringGuidance === 'string' ? rawNutritionGuidance.symptomMonitoringGuidance : '',
		restrictionsGuidance: typeof rawNutritionGuidance?.restrictionsGuidance === 'string' ? rawNutritionGuidance.restrictionsGuidance : '',
		additionalGuidance: typeof rawNutritionGuidance?.additionalGuidance === 'string' ? rawNutritionGuidance.additionalGuidance : '',
	}

	const normalizedAiGuidanceHighlights = Array.isArray(savedMenu.aiGuidanceHighlights)
		? savedMenu.aiGuidanceHighlights
			.filter((highlight): highlight is string => typeof highlight === 'string')
			.map((highlight) => normalizeTextField(highlight))
			.filter((highlight) => highlight.length > 0)
		: []

	const rawAiGenerationSettings = savedMenu.aiGenerationSettings
	const normalizedAiGenerationSettings: SavedPatientMenuAiGenerationSettingsResponse = {
		modelOverride: typeof rawAiGenerationSettings?.modelOverride === 'string' && rawAiGenerationSettings.modelOverride.trim().length > 0
			? rawAiGenerationSettings.modelOverride
			: null,
		planningFocus: typeof rawAiGenerationSettings?.planningFocus === 'string' ? rawAiGenerationSettings.planningFocus : '',
		clinicalStrictness: typeof rawAiGenerationSettings?.clinicalStrictness === 'string' ? rawAiGenerationSettings.clinicalStrictness : '',
		preparationProfile: typeof rawAiGenerationSettings?.preparationProfile === 'string' ? rawAiGenerationSettings.preparationProfile : '',
		budgetProfile: typeof rawAiGenerationSettings?.budgetProfile === 'string' ? rawAiGenerationSettings.budgetProfile : '',
		maxItemsPerGroup: typeof rawAiGenerationSettings?.maxItemsPerGroup === 'number' && Number.isFinite(rawAiGenerationSettings.maxItemsPerGroup)
			? rawAiGenerationSettings.maxItemsPerGroup
			: 4,
		preferredFoods: typeof rawAiGenerationSettings?.preferredFoods === 'string' ? rawAiGenerationSettings.preferredFoods : '',
		restrictedFoods: typeof rawAiGenerationSettings?.restrictedFoods === 'string' ? rawAiGenerationSettings.restrictedFoods : '',
		extraInstructions: typeof rawAiGenerationSettings?.extraInstructions === 'string' ? rawAiGenerationSettings.extraInstructions : '',
	}

	const rawAiRecipeGenerationSettings = savedMenu.aiRecipeGenerationSettings
	const normalizedAiRecipeGenerationSettings: SavedPatientMenuAiRecipeGenerationSettingsResponse = {
		modelOverride: typeof rawAiRecipeGenerationSettings?.modelOverride === 'string' && rawAiRecipeGenerationSettings.modelOverride.trim().length > 0
			? rawAiRecipeGenerationSettings.modelOverride
			: null,
		recipeFocus: typeof rawAiRecipeGenerationSettings?.recipeFocus === 'string' ? rawAiRecipeGenerationSettings.recipeFocus : '',
		preparationProfile: typeof rawAiRecipeGenerationSettings?.preparationProfile === 'string' ? rawAiRecipeGenerationSettings.preparationProfile : '',
		budgetProfile: typeof rawAiRecipeGenerationSettings?.budgetProfile === 'string' ? rawAiRecipeGenerationSettings.budgetProfile : '',
		recipeCount: typeof rawAiRecipeGenerationSettings?.recipeCount === 'number' && Number.isFinite(rawAiRecipeGenerationSettings.recipeCount)
			? rawAiRecipeGenerationSettings.recipeCount
			: 4,
		maxIngredientsPerRecipe: typeof rawAiRecipeGenerationSettings?.maxIngredientsPerRecipe === 'number'
			&& Number.isFinite(rawAiRecipeGenerationSettings.maxIngredientsPerRecipe)
			? rawAiRecipeGenerationSettings.maxIngredientsPerRecipe
			: 7,
		preferredFoods: typeof rawAiRecipeGenerationSettings?.preferredFoods === 'string' ? rawAiRecipeGenerationSettings.preferredFoods : '',
		restrictedFoods: typeof rawAiRecipeGenerationSettings?.restrictedFoods === 'string' ? rawAiRecipeGenerationSettings.restrictedFoods : '',
		extraInstructions: typeof rawAiRecipeGenerationSettings?.extraInstructions === 'string' ? rawAiRecipeGenerationSettings.extraInstructions : '',
	}

	return {
		...savedMenu,
		mealGroups: normalizedMealGroups,
		nutritionGuidance: normalizedNutritionGuidance,
		aiGuidanceHighlights: normalizedAiGuidanceHighlights,
		recipeSuggestions: normalizedRecipeSuggestions,
		aiGenerationSettings: normalizedAiGenerationSettings,
		aiRecipeGenerationSettings: normalizedAiRecipeGenerationSettings,
	}
}

async function extractErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
	try {
		const errorPayload = (await response.json()) as { message?: string }
		if (errorPayload.message?.trim()) {
			return errorPayload.message
		}
	} catch {
		// Mantem fallback caso o backend nao retorne JSON.
	}

	return fallbackMessage
}

function InfoField({ label, value }: InfoFieldProps) {
	return (
		<Box className="h-full w-full rounded-xl border border-[#e0ebf0] bg-[#f8fcfe] px-3 py-2.5">
			<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
				{label}
			</Text>
			<Text className="mt-1 text-sm font-semibold text-slate-900">
				{value}
			</Text>
		</Box>
	)
}

export function PatientDetailsPage() {
	const { patientId } = useParams<{ patientId: string }>()
	const navigate = useNavigate()
	const { token, logout, user } = useAuth()

	const [patient, setPatient] = useState<PatientDetailsResponse | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [savedMenus, setSavedMenus] = useState<SavedPatientMenuSummary[]>([])
	const [isLoadingSavedMenus, setIsLoadingSavedMenus] = useState(false)
	const [savedMenusErrorMessage, setSavedMenusErrorMessage] = useState<string | null>(null)
	const [savedMenusPage, setSavedMenusPage] = useState(1)
	const [savedMenusTotalPages, setSavedMenusTotalPages] = useState(0)
	const [savedMenusTotalCount, setSavedMenusTotalCount] = useState(0)
	const [savedMenuForPdf, setSavedMenuForPdf] = useState<SavedPatientMenuResponse | null>(null)
	const [savedMenuPdfBlobState, setSavedMenuPdfBlobState] = useState<MealPlanPdfBlobState | null>(null)
	const [pendingSavedMenuDownloadId, setPendingSavedMenuDownloadId] = useState<number | null>(null)
	const [savedMenuToEdit, setSavedMenuToEdit] = useState<SavedPatientMenuSummary | null>(null)
	const [savedMenuToDelete, setSavedMenuToDelete] = useState<SavedPatientMenuSummary | null>(null)
	const [isDeletingSavedMenu, setIsDeletingSavedMenu] = useState(false)
	const [savedMenusRefreshToken, setSavedMenusRefreshToken] = useState(0)
	const [currentNutritionist, setCurrentNutritionist] = useState<CurrentNutritionistProfileResponse | null>(null)
	const [nutritionistProfileImageForPdf, setNutritionistProfileImageForPdf] = useState<string | null>(null)
	const [tacoFoodById, setTacoFoodById] = useState<Map<string, TacoFoodTableEntry>>(new Map())

	const buttonClassNames = {
		root: ButtonStyle.root,
		label: ButtonStyle.label,
	}

	const neutralButtonClassNames = {
		root: ButtonStyle.neutralRoot,
		label: ButtonStyle.neutralLabel,
	}
	const modalActionButtonSizeClassName = 'w-[128px]'

	const parsedPatientId = useMemo(() => {
		if (!patientId) {
			return null
		}

		const parsedId = Number(patientId)
		if (!Number.isInteger(parsedId) || parsedId <= 0) {
			return null
		}

		return parsedId
	}, [patientId])

	useEffect(() => {
		if (!token) {
			setCurrentNutritionist(null)
			return
		}

		const controller = new AbortController()

		const loadCurrentNutritionist = async () => {
			try {
				const response = await fetch(buildApiUrl('/api/users/me'), {
					method: 'GET',
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: 'application/json',
					},
					signal: controller.signal,
				})

				if (response.status === 401) {
					logout()
					return
				}

				if (!response.ok) {
					if (!controller.signal.aborted) {
						setCurrentNutritionist(null)
					}
					return
				}

				const data = (await response.json()) as CurrentNutritionistProfileResponse
				if (!controller.signal.aborted) {
					setCurrentNutritionist(data)
				}
			} catch {
				if (!controller.signal.aborted) {
					setCurrentNutritionist(null)
				}
			}
		}

		void loadCurrentNutritionist()

		return () => {
			controller.abort()
		}
	}, [logout, token])

	useEffect(() => {
		const normalizedProfileImage = normalizeProfileImageSrc(currentNutritionist?.profilePicture)
		if (!normalizedProfileImage) {
			setNutritionistProfileImageForPdf(null)
			return
		}

		if (normalizedProfileImage.startsWith('data:image/')) {
			setNutritionistProfileImageForPdf(normalizedProfileImage)
			return
		}

		const controller = new AbortController()

		const resolveProfileImage = async () => {
			try {
				const response = await fetch(normalizedProfileImage, {
					method: 'GET',
					headers: token
						? {
							Authorization: `Bearer ${token}`,
						}
						: undefined,
					signal: controller.signal,
				})

				if (!response.ok) {
					throw new Error('Não foi possível carregar a foto do nutricionista.')
				}

				const imageBlob = await response.blob()
				const imageDataUrl = await convertBlobToDataUrl(imageBlob)
				if (!controller.signal.aborted) {
					setNutritionistProfileImageForPdf(imageDataUrl)
				}
			} catch {
				if (!controller.signal.aborted) {
					setNutritionistProfileImageForPdf(normalizedProfileImage)
				}
			}
		}

		void resolveProfileImage()

		return () => {
			controller.abort()
		}
	}, [currentNutritionist?.profilePicture, token])

	useEffect(() => {
		let isMounted = true

		const loadTacoFoodEntries = async () => {
			try {
				const tacoModule = await import('../../dates/tables/TACO.json')
				if (!isMounted) {
					return
				}

				const parsedTacoFoodEntries = parseTacoFoodEntries(tacoModule.default)
				setTacoFoodById(new Map(parsedTacoFoodEntries.map((entry) => [String(entry.id), entry])))
			} catch {
				if (!isMounted) {
					return
				}

				setTacoFoodById(new Map())
			}
		}

		void loadTacoFoodEntries()

		return () => {
			isMounted = false
		}
	}, [])

	const nutritionistProfileForPdf = useMemo<MealPlanPdfNutritionistProfile | null>(() => {
		const normalizedName = normalizeTextField(currentNutritionist?.name ?? user?.name ?? '')
		const normalizedEmail = normalizeTextField(currentNutritionist?.email ?? user?.email ?? '')
		const normalizedPhone = normalizeTextField(currentNutritionist?.phone ?? '')
		const normalizedCrn = normalizeTextField(currentNutritionist?.crn ?? '')
		const normalizedInstitution = normalizeTextField(currentNutritionist?.institution ?? '')
		const normalizedCity = normalizeTextField(currentNutritionist?.city ?? '')
		const normalizedState = normalizeTextField(currentNutritionist?.state ?? '')

		if (
			!normalizedName &&
			!normalizedEmail &&
			!normalizedPhone &&
			!normalizedCrn &&
			!normalizedInstitution &&
			!normalizedCity &&
			!normalizedState &&
			!nutritionistProfileImageForPdf
		) {
			return null
		}

		return {
			name: normalizedName || 'Nutricionista responsavel',
			email: normalizedEmail || null,
			phone: normalizedPhone || null,
			crn: normalizedCrn || null,
			institution: normalizedInstitution || null,
			city: normalizedCity || null,
			state: normalizedState || null,
			profileImage: nutritionistProfileImageForPdf,
		}
	}, [
		currentNutritionist?.city,
		currentNutritionist?.crn,
		currentNutritionist?.email,
		currentNutritionist?.institution,
		currentNutritionist?.name,
		currentNutritionist?.phone,
		currentNutritionist?.state,
		nutritionistProfileImageForPdf,
		user?.email,
		user?.name,
	])

	const savedMenuOrientationTipsForPdf = useMemo(() => {
		if (!patient || !savedMenuForPdf) {
			return []
		}

		return buildNutritionGuidanceTips(
			patient,
			savedMenuForPdf.nutritionGuidance,
			savedMenuForPdf.aiGuidanceHighlights,
		)
	}, [patient, savedMenuForPdf])

	const savedMenuNutritionPreviewForPdf = useMemo<MealPlanPdfNutritionPreviewData | null>(() => {
		if (!savedMenuForPdf) {
			return null
		}

		return buildPlanNutritionPreviewData(
			savedMenuForPdf.mealGroups,
			tacoFoodById,
			patient?.gender ?? '',
		)
	}, [patient?.gender, savedMenuForPdf, tacoFoodById])

	const handleSavedMenuPdfBlobStateChange = useCallback((nextBlobState: MealPlanPdfBlobState) => {
		setSavedMenuPdfBlobState(nextBlobState)
	}, [])

	const closeEditSavedMenuModal = useCallback(() => {
		setSavedMenuToEdit(null)
	}, [])

	const closeDeleteSavedMenuModal = useCallback(() => {
		if (isDeletingSavedMenu) {
			return
		}

		setSavedMenuToDelete(null)
	}, [isDeletingSavedMenu])

	const handleEditSavedMenu = useCallback((savedMenu: SavedPatientMenuSummary) => {
		setSavedMenuToEdit(savedMenu)
	}, [])

	const handleConfirmEditSavedMenu = useCallback(() => {
		if (!savedMenuToEdit || parsedPatientId === null) {
			return
		}

		navigate(`/patients/${parsedPatientId}/menu`, {
			state: {
				prefillMenuDraft: savedMenuToEdit.source,
				prefillSource: 'saved-history',
			},
		})
		closeEditSavedMenuModal()
	}, [closeEditSavedMenuModal, navigate, parsedPatientId, savedMenuToEdit])

	const handleRequestDeleteSavedMenu = useCallback((savedMenu: SavedPatientMenuSummary) => {
		setSavedMenuToDelete(savedMenu)
	}, [])

	const handleConfirmDeleteSavedMenu = useCallback(async () => {
		if (!token || !savedMenuToDelete || isDeletingSavedMenu || parsedPatientId === null) {
			return
		}

		try {
			setIsDeletingSavedMenu(true)

			const response = await fetch(
				buildApiUrl(`/api/patients/${parsedPatientId}/menu/${savedMenuToDelete.id}`),
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: 'application/json',
					},
				},
			)

			if (response.status === 401) {
				logout()
				return
			}

			if (!response.ok) {
				const message = await extractErrorMessage(response, DELETE_PATIENT_MENU_ERROR_MESSAGE)
				throw new Error(message)
			}

			if (savedMenuForPdf?.id === savedMenuToDelete.id) {
				setSavedMenuForPdf(null)
				setSavedMenuPdfBlobState(null)
				setPendingSavedMenuDownloadId(null)
			}

			setSavedMenuToDelete(null)
			showSuccessNotification('Cardápio excluído', 'O cardápio selecionado foi removido com sucesso.')

			if (savedMenus.length === 1 && savedMenusPage > 1) {
				setSavedMenusPage((currentPage) => Math.max(currentPage - 1, 1))
			} else {
				setSavedMenusRefreshToken((currentToken) => currentToken + 1)
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : DELETE_PATIENT_MENU_ERROR_MESSAGE
			showErrorNotification('Erro ao excluir cardápio', message)
		} finally {
			setIsDeletingSavedMenu(false)
		}
	}, [
		isDeletingSavedMenu,
		logout,
		parsedPatientId,
		savedMenuForPdf?.id,
		savedMenuToDelete,
		savedMenus.length,
		savedMenusPage,
		token,
	])

	const handleRequestSavedMenuPdfDownload = useCallback((savedMenu: SavedPatientMenuResponse) => {
		if (
			savedMenuForPdf?.id === savedMenu.id &&
			savedMenuPdfBlobState?.url &&
			savedMenuPdfBlobState.downloadFileName
		) {
			triggerLocalDownload(savedMenuPdfBlobState.url, savedMenuPdfBlobState.downloadFileName)
			return
		}

		setSavedMenuPdfBlobState(null)
		setSavedMenuForPdf(savedMenu)
		setPendingSavedMenuDownloadId(savedMenu.id)
	}, [savedMenuForPdf?.id, savedMenuPdfBlobState?.downloadFileName, savedMenuPdfBlobState?.url])

	useEffect(() => {
		setSavedMenusPage(1)
		setSavedMenus([])
		setSavedMenusTotalPages(0)
		setSavedMenusTotalCount(0)
		setSavedMenuForPdf(null)
		setSavedMenuPdfBlobState(null)
		setPendingSavedMenuDownloadId(null)
		setSavedMenuToEdit(null)
		setSavedMenuToDelete(null)
		setIsDeletingSavedMenu(false)
		setSavedMenusRefreshToken(0)
	}, [parsedPatientId])

	useEffect(() => {
		if (
			pendingSavedMenuDownloadId === null ||
			!savedMenuForPdf ||
			savedMenuForPdf.id !== pendingSavedMenuDownloadId ||
			!savedMenuPdfBlobState?.url ||
			!savedMenuPdfBlobState.downloadFileName
		) {
			return
		}

		triggerLocalDownload(savedMenuPdfBlobState.url, savedMenuPdfBlobState.downloadFileName)

		setPendingSavedMenuDownloadId(null)
	}, [pendingSavedMenuDownloadId, savedMenuForPdf, savedMenuPdfBlobState])

	useEffect(() => {
		if (pendingSavedMenuDownloadId === null || !savedMenuPdfBlobState?.generationErrorMessage) {
			return
		}

		setPendingSavedMenuDownloadId(null)
	}, [pendingSavedMenuDownloadId, savedMenuPdfBlobState?.generationErrorMessage])

	useEffect(() => {
		const controller = new AbortController()

		const loadPatientDetails = async () => {
			if (!token) {
				logout()
				return
			}

			if (parsedPatientId === null) {
				setPatient(null)
				setErrorMessage('Identificador de paciente inválido.')
				setIsLoading(false)
				return
			}

			try {
				setIsLoading(true)
				setErrorMessage(null)

				const response = await fetch(buildApiUrl(`/api/patients/${parsedPatientId}`), {
					method: 'GET',
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: 'application/json',
					},
					signal: controller.signal,
				})

				if (response.status === 401) {
					logout()
					return
				}

				if (response.status === 404) {
					throw new Error('Paciente não encontrado.')
				}

				if (!response.ok) {
					const message = await extractErrorMessage(response, LOAD_PATIENT_DETAILS_ERROR_MESSAGE)
					throw new Error(message)
				}

				const data = (await response.json()) as PatientDetailsResponse
				if (!controller.signal.aborted) {
					setPatient(data)
				}
			} catch (error) {
				if (controller.signal.aborted) {
					return
				}

				const message = error instanceof Error ? error.message : LOAD_PATIENT_DETAILS_ERROR_MESSAGE
				setPatient(null)
				setErrorMessage(message)
			} finally {
				if (!controller.signal.aborted) {
					setIsLoading(false)
				}
			}
		}

		void loadPatientDetails()

		return () => {
			controller.abort()
		}
	}, [logout, parsedPatientId, token])

	useEffect(() => {
		const controller = new AbortController()

		const loadSavedMenus = async () => {
			if (!token || parsedPatientId === null) {
				setSavedMenus([])
				setSavedMenusErrorMessage(null)
				setSavedMenusTotalCount(0)
				setSavedMenusTotalPages(0)
				setIsLoadingSavedMenus(false)
				return
			}

			try {
				setIsLoadingSavedMenus(true)
				setSavedMenusErrorMessage(null)

				const response = await fetch(
					buildApiUrl(`/api/patients/${parsedPatientId}/menu/history?page=${savedMenusPage}&pageSize=${SAVED_MENUS_PAGE_SIZE}`),
					{
						method: 'GET',
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: 'application/json',
						},
						signal: controller.signal,
					},
				)

				if (response.status === 401) {
					logout()
					return
				}

				if (response.status === 404) {
					const legacyResponse = await fetch(buildApiUrl(`/api/patients/${parsedPatientId}/menu`), {
						method: 'GET',
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: 'application/json',
						},
						signal: controller.signal,
					})

					if (legacyResponse.status === 401) {
						logout()
						return
					}

					if (legacyResponse.status === 404) {
						if (!controller.signal.aborted) {
							setSavedMenus([])
							setSavedMenusTotalCount(0)
							setSavedMenusTotalPages(0)
						}
						return
					}

					if (!legacyResponse.ok) {
						const message = await extractErrorMessage(legacyResponse, LOAD_PATIENT_MENU_ERROR_MESSAGE)
						throw new Error(message)
					}

					const legacyData = (await legacyResponse.json()) as SavedPatientMenuResponse
					const normalizedLegacyMenu = normalizeSavedMenuResponse(legacyData)
					if (!controller.signal.aborted) {
						setSavedMenus([summarizeSavedMenu(normalizedLegacyMenu)])
						setSavedMenusTotalCount(1)
						setSavedMenusTotalPages(1)
						if (savedMenusPage !== 1) {
							setSavedMenusPage(1)
						}
					}
					return
				}

				if (!response.ok) {
					const message = await extractErrorMessage(response, LOAD_PATIENT_MENU_ERROR_MESSAGE)
					throw new Error(message)
				}

				const data = (await response.json()) as SavedPatientMenuHistoryResponse
				const normalizedItems = Array.isArray(data.items)
					? data.items.map(normalizeSavedMenuResponse)
					: []
				const totalCount = Number.isFinite(data.totalCount) && data.totalCount >= 0
					? data.totalCount
					: normalizedItems.length
				const totalPages = Number.isFinite(data.totalPages) && data.totalPages >= 0
					? data.totalPages
					: (totalCount === 0 ? 0 : Math.ceil(totalCount / SAVED_MENUS_PAGE_SIZE))
				const resolvedPage = Number.isFinite(data.page) && data.page > 0 ? data.page : 1

				if (!controller.signal.aborted) {
					setSavedMenus(normalizedItems.map(summarizeSavedMenu))
					setSavedMenusTotalCount(totalCount)
					setSavedMenusTotalPages(totalPages)
					if (resolvedPage !== savedMenusPage) {
						setSavedMenusPage(resolvedPage)
					}
				}
			} catch (error) {
				if (controller.signal.aborted) {
					return
				}

				const message = error instanceof Error ? error.message : LOAD_PATIENT_MENU_ERROR_MESSAGE
				setSavedMenus([])
				setSavedMenusErrorMessage(message)
				setSavedMenusTotalCount(0)
				setSavedMenusTotalPages(0)
			} finally {
				if (!controller.signal.aborted) {
					setIsLoadingSavedMenus(false)
				}
			}
		}

		void loadSavedMenus()

		return () => {
			controller.abort()
		}
	}, [logout, parsedPatientId, savedMenusPage, savedMenusRefreshToken, token])

	const age = useMemo(() => {
		if (!patient) {
			return null
		}

		return calculateAgeFromIsoDate(patient.birthDate)
	}, [patient])

	const goalTags = useMemo(() => {
		if (!patient) {
			return []
		}

		return parseGoalTags(patient.goal)
	}, [patient])

	const medicalConditionTags = useMemo(() => {
		if (!patient) {
			return []
		}

		return patient.medicalConditions
			.map((condition) => formatMedicalCondition(condition))
			.filter((condition) => condition.length > 0)
	}, [patient])

	const genderMeta = patient ? getGenderMeta(patient.gender) : null
	const activityMeta = patient ? getActivityMeta(patient.activityLevel) : null
	const patientHeaderTitle = patient ? `Paciente: ${patient.name}` : 'Paciente: Carregando...'

	return (
		<Box className="flex h-screen flex-row max-[768px]:h-dvh max-[768px]:flex-col">
			<SideBar
				title="NutriSaaS"
				items={APP_SIDEBAR_ITEMS}
				footer={null}
				color="--color4"
				defaultCollapsed={true}
			/>

			<Box className="flex min-w-0 flex-1 flex-col overflow-hidden p-0 max-[768px]:w-full">
				<Box className="px-3 md:px-6">
					<PageInfo
						title={(
							<Text className="text-lg font-semibold leading-none text-white md:text-3xl">
								{patientHeaderTitle}
							</Text>
						)}
					/>
				</Box>

				<Box className="min-h-0 flex-1 p-3 md:p-6">
					<PageContentContainer
						className="bg-[hsl(var(--card))]"
						contentClassName="gap-5 overflow-auto"
						footer={(
							<Group justify="end" className="w-full">
								<Button
									type="button"
									radius="md"
									classNames={buttonClassNames}
									onClick={() => {
										if (parsedPatientId !== null) {
											navigate(`/patients/${parsedPatientId}/menu`, {
												state: {
													prefillSource: 'new-empty',
												},
											})
										}
									}}
									disabled={parsedPatientId === null}
								>
									Montar cardapio
								</Button>

								<Button
									type="button"
									radius="md"
									classNames={neutralButtonClassNames}
									onClick={() => navigate('/patients')}
								>
									Voltar para lista
								</Button>
							</Group>
						)}
					>
						{isLoading ? (
							<Stack gap="md">
								<Box className="rounded-2xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-5">
									<Skeleton height={22} width="40%" radius="sm" />
									<Skeleton height={14} mt={12} width="58%" radius="sm" />
								</Box>
								<Box className="rounded-2xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-5">
									<Grid gutter="md">
										{Array.from({ length: 8 }).map((_, index) => (
											<Grid.Col key={`detail-field-skeleton-${index}`} span={{ base: 12, md: 6, lg: 3 }}>
												<Skeleton height={54} radius="md" />
											</Grid.Col>
										))}
									</Grid>
								</Box>
							</Stack>
						) : errorMessage ? (
							<Box className="rounded-2xl border border-red-200 bg-red-50/80 p-5">
								<Text className="text-sm font-semibold text-red-700">
									{errorMessage}
								</Text>
							</Box>
						) : patient ? (
							<Stack gap="md">
								<Box className="rounded-2xl border border-[#c8e4ef] bg-[linear-gradient(125deg,rgba(39,144,176,0.12)_0%,rgba(148,186,101,0.13)_52%,rgba(255,255,255,0.98)_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:p-5">
									<Box>
										<Text className="text-lg font-semibold text-slate-900">
											{patient.name}
										</Text>
										<Text className="mt-1 text-xs font-medium text-slate-600">
											ID #{patient.id} • Cadastrado em {formatDateTime(patient.createdAt)}
										</Text>
									</Box>
								</Box>

								<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4 md:p-5">
									<Text className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
										Dados básicos
									</Text>
									<Grid gutter="md" mt="xs">
										<Grid.Col span={{ base: 12, md: 6, lg: 3 }} className="flex">
											<InfoField label="Nome completo" value={patient.name} />
										</Grid.Col>
										<Grid.Col span={{ base: 12, md: 6, lg: 3 }} className="flex">
											<InfoField label="Data de nascimento" value={formatDate(patient.birthDate)} />
										</Grid.Col>
										<Grid.Col span={{ base: 12, md: 6, lg: 3 }} className="flex">
											<InfoField label="Idade" value={age === null ? '-' : `${age} anos`} />
										</Grid.Col>
										<Grid.Col span={{ base: 12, md: 6, lg: 3 }} className="flex">
											<Box className="h-full w-full rounded-xl border border-[#e0ebf0] bg-[#f8fcfe] px-3 py-2.5">
												<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
													Sexo
												</Text>
												{genderMeta ? (
													<Box
														component="span"
														className={cn(
															'mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-semibold',
															genderMeta.className,
														)}
													>
														{genderMeta.label}
													</Box>
												) : (
													<Text className="mt-1 text-sm font-semibold text-slate-900">
														-
													</Text>
												)}
											</Box>
										</Grid.Col>
									</Grid>
								</Box>

								<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4 md:p-5">
									<Text className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
										Plano nutricional
									</Text>
									<Grid gutter="md" mt="xs">
										<Grid.Col span={{ base: 12, md: 6 }} className="flex">
											<Box className="h-full w-full rounded-xl border border-[#e0ebf0] bg-[#f8fcfe] px-3 py-2.5">
												<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
													Objetivos
												</Text>
												{goalTags.length > 0 ? (
													<Box className="mt-1 flex flex-wrap gap-1.5">
														{goalTags.map((goalTag, index) => (
															<Box
																key={`${patient.id}-goal-${goalTag}-${index}`}
																component="span"
																className="inline-flex items-center rounded-full border border-[#c6dbe3] bg-[#eaf3f7] px-2.5 py-1 text-[0.68rem] font-semibold text-slate-700"
															>
																{goalTag}
															</Box>
														))}
													</Box>
												) : (
													<Text className="mt-1 text-sm font-semibold text-slate-900">
														-
													</Text>
												)}
											</Box>
										</Grid.Col>

										<Grid.Col span={{ base: 12, md: 6 }} className="flex">
											<Box className="h-full w-full rounded-xl border border-[#e0ebf0] bg-[#f8fcfe] px-3 py-2.5">
												<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
													Nível de atividade
												</Text>
												{activityMeta ? (
													<Box
														component="span"
														className={cn(
															'mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-semibold',
															activityMeta.className,
														)}
													>
														{activityMeta.label}
													</Box>
												) : (
													<Text className="mt-1 text-sm font-semibold text-slate-900">
														-
													</Text>
												)}
											</Box>
										</Grid.Col>
									</Grid>
								</Box>

								<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4 md:p-5">
									<Text className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
										Indicadores e medidas
									</Text>
									<Stack gap="md" mt="xs">
										<Grid gutter="md">
											<Grid.Col span={{ base: 12, md: 4 }}>
												<InfoField label="Peso" value={formatMetric(patient.weight, 'kg')} />
											</Grid.Col>
											<Grid.Col span={{ base: 12, md: 4 }}>
												<InfoField label="Altura" value={formatMetric(patient.height, 'cm', 0)} />
											</Grid.Col>
											<Grid.Col span={{ base: 12, md: 4 }}>
												<InfoField label="IMC" value={patient.bmi.toFixed(1)} />
											</Grid.Col>
										</Grid>

										<Grid gutter="md">
											<Grid.Col span={{ base: 12, md: 3 }}>
												<InfoField
													label="Circ. braço"
													value={formatOptionalMetric(patient.armCircumference, 'cm')}
												/>
											</Grid.Col>
											<Grid.Col span={{ base: 12, md: 3 }}>
												<InfoField
													label="Circ. cintura"
													value={formatOptionalMetric(patient.waistCircumference, 'cm')}
												/>
											</Grid.Col>
											<Grid.Col span={{ base: 12, md: 3 }}>
												<InfoField
													label="Circ. quadril"
													value={formatOptionalMetric(patient.hipCircumference, 'cm')}
												/>
											</Grid.Col>
											<Grid.Col span={{ base: 12, md: 3 }}>
												<InfoField
													label="Circ. coxa"
													value={formatOptionalMetric(patient.thighCircumference, 'cm')}
												/>
											</Grid.Col>
										</Grid>

										<Grid gutter="md">
											<Grid.Col span={{ base: 12, md: 3 }}>
												<InfoField
													label="Subescapular"
													value={formatOptionalMetric(patient.subscapularSkinfold, 'mm')}
												/>
											</Grid.Col>
											<Grid.Col span={{ base: 12, md: 3 }}>
												<InfoField
													label="Axilar média"
													value={formatOptionalMetric(patient.axillarySkinfold, 'mm')}
												/>
											</Grid.Col>
											<Grid.Col span={{ base: 12, md: 3 }}>
												<InfoField
													label="Suprailíaca"
													value={formatOptionalMetric(patient.suprailiacSkinfold, 'mm')}
												/>
											</Grid.Col>
											<Grid.Col span={{ base: 12, md: 3 }}>
												<InfoField
													label="Abdominal"
													value={formatOptionalMetric(patient.abdominalSkinfold, 'mm')}
												/>
											</Grid.Col>
										</Grid>

										<Grid gutter="md">
											<Grid.Col span={{ base: 12, md: 6 }}>
												<InfoField label="TMB" value={formatMetric(patient.bmr, 'kcal', 0)} />
											</Grid.Col>
											<Grid.Col span={{ base: 12, md: 6 }}>
												<InfoField label="GET" value={formatMetric(patient.tdee, 'kcal', 0)} />
											</Grid.Col>
										</Grid>
									</Stack>
								</Box>

								<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4 md:p-5">
									<Text className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
										Condições médicas
									</Text>
									<Box className="mt-3 rounded-xl border border-[#e0ebf0] bg-[#f8fcfe] px-3 py-2.5">
										{medicalConditionTags.length > 0 ? (
											<Box className="mt-1 flex flex-wrap gap-1.5">
												{medicalConditionTags.map((condition, index) => (
													<Box
														key={`${patient.id}-medical-condition-${condition}-${index}`}
														component="span"
														className="inline-flex items-center rounded-full border border-[#d7e4ea] bg-[#eff6fa] px-2.5 py-1 text-[0.7rem] font-semibold text-slate-700"
													>
														{condition}
													</Box>
												))}
											</Box>
										) : (
											<Text className="mt-1 text-sm font-medium text-slate-500">
												Nenhuma condição médica informada.
											</Text>
										)}
									</Box>
								</Box>

								<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4 md:p-5">
									<Text className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
										Cardápios salvos
									</Text>
									<Text className="mt-1 text-xs font-medium text-slate-600">
										Histórico de rascunhos salvos para este paciente.
									</Text>

									{isLoadingSavedMenus ? (
										<Box className="mt-3 rounded-2xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-3">
											<Box className="grid grid-cols-7 gap-3 rounded-xl border border-[#d2e4eb] bg-[#edf5f8] p-3">
												{Array.from({ length: 7 }).map((_, index) => (
													<Skeleton key={`saved-menu-header-skeleton-${index}`} height={12} radius="sm" />
												))}
											</Box>
											<Box className="mt-3 space-y-2">
												{Array.from({ length: 2 }).map((_, index) => (
													<Box
														key={`saved-menu-row-skeleton-${index}`}
														className="grid grid-cols-7 gap-3 rounded-xl border border-slate-100 bg-white p-3"
													>
														{Array.from({ length: 7 }).map((__, cellIndex) => (
															<Skeleton key={`saved-menu-cell-skeleton-${index}-${cellIndex}`} height={16} radius="sm" />
														))}
													</Box>
												))}
											</Box>
										</Box>
									) : savedMenusErrorMessage ? (
										<Box className="mt-3 rounded-xl border border-red-200 bg-red-50/80 p-4">
											<Text className="text-sm font-semibold text-red-700">
												{savedMenusErrorMessage}
											</Text>
										</Box>
									) : savedMenus.length === 0 ? (
										<Box className="mt-3 rounded-xl border border-[#d7e4ea] bg-[#f8fcfe] p-4">
											<Text className="text-sm font-medium text-slate-600">
												Este paciente ainda não possui cardápio salvo.
											</Text>
										</Box>
									) : (
										<Box className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)]">
											<Box className="patients-table-scroll min-h-0 flex-1 overflow-auto">
												<Table
													verticalSpacing="sm"
													horizontalSpacing="sm"
													className="min-w-[980px] w-full"
												>
													<Table.Thead>
														<Table.Tr>
															<Table.Th className="sticky top-0 z-10 w-[22%] border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
																Salvo em
															</Table.Th>
															<Table.Th className="sticky top-0 z-10 w-[22%] border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
																Atualizado em
															</Table.Th>
															<Table.Th className="sticky top-0 z-10 w-[12%] border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
																Etapa
															</Table.Th>
															<Table.Th className="sticky top-0 z-10 w-[10%] border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
																Refeições
															</Table.Th>
															<Table.Th className="sticky top-0 z-10 w-[8%] border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
																Itens
															</Table.Th>
															<Table.Th className="sticky top-0 z-10 w-[8%] border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
																Receitas
															</Table.Th>
															<Table.Th className="sticky top-0 z-10 w-[1%] whitespace-nowrap border-b border-[#d2e4eb] bg-[#edf5f8] text-center text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
																Ações
															</Table.Th>
														</Table.Tr>
													</Table.Thead>
													<Table.Tbody>
														{savedMenus.map((savedMenu) => (
															<Table.Tr key={`saved-menu-${savedMenu.id}`} className="border-b border-slate-100 last:border-b-0">
																<Table.Td className="text-sm font-semibold text-slate-900">
																	{formatDateTime(savedMenu.createdAt)}
																</Table.Td>
																<Table.Td className="text-sm text-slate-700">
																	{formatDateTime(savedMenu.updatedAt)}
																</Table.Td>
																<Table.Td>
																	<Box
																		component="span"
																		className="inline-flex items-center rounded-full border border-[#d0e4eb] bg-[#eef7fb] px-2.5 py-1 text-[0.7rem] font-semibold text-slate-700"
																	>
																		{formatDataEntryStep(savedMenu.activeDataEntryStep)}
																	</Box>
																</Table.Td>
																<Table.Td className="text-sm font-semibold text-slate-800">
																	{savedMenu.mealGroupsCount}
																</Table.Td>
																<Table.Td className="text-sm font-semibold text-slate-800">
																	{savedMenu.mealItemsCount}
																</Table.Td>
																<Table.Td className="text-sm font-semibold text-slate-800">
																	{savedMenu.recipeSuggestionsCount}
																</Table.Td>
																<Table.Td className="w-[1%] whitespace-nowrap py-2">
																	<Group gap={6} wrap="nowrap" justify="end">
																		<button
																			type="button"
																			onClick={() => handleRequestSavedMenuPdfDownload(savedMenu.source)}
																			disabled={
																				isLoadingSavedMenus
																				|| (
																					pendingSavedMenuDownloadId === savedMenu.id
																					&& !savedMenuPdfBlobState?.generationErrorMessage
																					&& (!savedMenuPdfBlobState?.url || Boolean(savedMenuPdfBlobState?.isGeneratingBlob))
																				)
																			}
																			className={cn(
																				'inline-flex h-7 items-center gap-1 rounded-md border border-[#b7d4df] bg-white px-2 py-1 text-[0.62rem] font-semibold uppercase leading-none tracking-[0.04em] text-[#2b5f70] transition-colors hover:bg-[#eef7fb] disabled:cursor-not-allowed disabled:opacity-60',
																			)}
																		>
																			<MdDownload aria-hidden size={12} />
																			{pendingSavedMenuDownloadId === savedMenu.id
																				&& !savedMenuPdfBlobState?.generationErrorMessage
																				&& (!savedMenuPdfBlobState?.url || Boolean(savedMenuPdfBlobState?.isGeneratingBlob))
																				? 'Gerando'
																				: 'Baixar'}
																		</button>
																		<button
																			type="button"
																			onClick={() => handleEditSavedMenu(savedMenu)}
																			disabled={isLoadingSavedMenus || parsedPatientId === null}
																			className={cn(
																				'inline-flex h-7 items-center gap-1 rounded-md border border-[#f1c27a] bg-white px-2 py-1 text-[0.62rem] font-semibold uppercase leading-none tracking-[0.04em] text-[#b86f09] transition-colors hover:bg-[#fff7eb] disabled:cursor-not-allowed disabled:opacity-60',
																			)}
																		>
																			<MdEdit aria-hidden size={12} />
																			Editar
																		</button>
																		<button
																			type="button"
																			onClick={() => handleRequestDeleteSavedMenu(savedMenu)}
																			disabled={isLoadingSavedMenus || isDeletingSavedMenu}
																			className={cn(
																				'inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-[0.62rem] font-semibold uppercase leading-none tracking-[0.04em] text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60',
																			)}
																		>
																			<MdDeleteOutline aria-hidden size={12} />
																			Excluir
																		</button>
																	</Group>
																</Table.Td>
															</Table.Tr>
														))}
													</Table.Tbody>
												</Table>
											</Box>
											{savedMenuPdfBlobState?.generationErrorMessage ? (
												<Text className="px-4 pb-3 pt-2 text-xs font-medium text-red-600">
													Erro ao gerar o PDF do cardápio: {savedMenuPdfBlobState.generationErrorMessage}
												</Text>
											) : null}
											{savedMenusTotalPages > 1 ? (
												<Group justify="space-between" className="border-t border-[#d2e4eb] px-4 py-3">
													<Text className="text-xs font-medium text-slate-600">
														{savedMenusTotalCount} cardápio(s) salvo(s)
													</Text>
													<Pagination
														value={savedMenusPage}
														onChange={setSavedMenusPage}
														total={savedMenusTotalPages}
														siblings={1}
														boundaries={1}
														size="sm"
													/>
												</Group>
											) : null}
										</Box>
									)}
								</Box>

								{patient && savedMenuForPdf ? (
									<Box className="hidden">
										<MealPlanPdfCanvasPreview
											patient={patient}
											mealGroups={savedMenuForPdf.mealGroups}
											orientationTips={savedMenuOrientationTipsForPdf}
											nutritionPreview={savedMenuNutritionPreviewForPdf}
											recipeSuggestions={savedMenuForPdf.recipeSuggestions}
											nutritionistProfile={nutritionistProfileForPdf}
											showDownloadButton={false}
											onPdfBlobStateChange={handleSavedMenuPdfBlobStateChange}
										/>
									</Box>
								) : null}
							</Stack>
						) : (
							<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-5">
								<Text className="text-sm font-semibold text-slate-700">
									Paciente indisponível para exibição.
								</Text>
							</Box>
						)}
					</PageContentContainer>
				</Box>
			</Box>

			<AppModal
				opened={savedMenuToEdit !== null}
				onClose={closeEditSavedMenuModal}
				title="Confirmar edição"
				centered
				size="30%"
				overlayProps={{ blur: 2, backgroundOpacity: 0.45 }}
			>
				<Box className="px-5 pb-5 pt-4">
					<Group align="flex-start" wrap="nowrap" gap="sm" className="flex items-center">
						<Box className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
							<MdEdit aria-hidden size={18} />
						</Box>

						<Box className="min-w-0">
							<Text className="mt-1 text-sm leading-relaxed text-slate-700">
								Deseja abrir este cardápio salvo em{' '}
								<Text component="span" className="font-semibold text-slate-900">
									{savedMenuToEdit ? formatDateTime(savedMenuToEdit.updatedAt) : '-'}
								</Text>{' '}
								para edição?
							</Text>
						</Box>
					</Group>

					<Group justify="flex-end" gap="sm" mt="xl" className="border-t border-[#e4edf1] pt-4">
						<Button
							onClick={closeEditSavedMenuModal}
							classNames={neutralButtonClassNames}
							className={modalActionButtonSizeClassName}
						>
							Cancelar
						</Button>
						<Button
							classNames={buttonClassNames}
							onClick={handleConfirmEditSavedMenu}
							className={modalActionButtonSizeClassName}
						>
							Sim, editar
						</Button>
					</Group>
				</Box>
			</AppModal>

			<AppModal
				opened={savedMenuToDelete !== null}
				onClose={closeDeleteSavedMenuModal}
				title="Confirmar exclusão"
				centered
				size="30%"
				closeOnClickOutside={!isDeletingSavedMenu}
				closeOnEscape={!isDeletingSavedMenu}
				withCloseButton={!isDeletingSavedMenu}
				overlayProps={{ blur: 2, backgroundOpacity: 0.45 }}
			>
				<Box className="px-5 pb-5 pt-4">
					<Group align="flex-start" wrap="nowrap" gap="sm" className="flex items-center">
						<Box className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700">
							<MdDeleteOutline aria-hidden size={18} />
						</Box>

						<Box className="min-w-0">
							<Text className="mt-1 text-sm leading-relaxed text-slate-700">
								Deseja realmente excluir o cardápio salvo em{' '}
								<Text component="span" className="font-semibold text-slate-900">
									{savedMenuToDelete ? formatDateTime(savedMenuToDelete.updatedAt) : '-'}
								</Text>
								? Essa ação não pode ser desfeita.
							</Text>
						</Box>
					</Group>

					<Group justify="flex-end" gap="sm" mt="xl" className="border-t border-[#e4edf1] pt-4">
						<Button
							onClick={closeDeleteSavedMenuModal}
							disabled={isDeletingSavedMenu}
							classNames={neutralButtonClassNames}
							className={modalActionButtonSizeClassName}
						>
							Cancelar
						</Button>
						<Button
							onClick={handleConfirmDeleteSavedMenu}
							loading={isDeletingSavedMenu}
							className="h-11 w-[128px] border border-red-600 bg-red-600 text-white transition-colors hover:bg-red-700"
						>
							Sim, excluir
						</Button>
					</Group>
				</Box>
			</AppModal>
		</Box>
	)
}
