import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { ActionIcon, Box, Button, Divider, Fieldset, Grid, Group, LoadingOverlay, Modal, NumberInput, Select, Skeleton, Spoiler, Stack, Stepper, Text, TextInput, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDebouncedValue } from '@mantine/hooks'
import { IoAlertCircleOutline, IoCheckmarkCircleOutline } from 'react-icons/io5'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { MdAdd, MdArrowBack, MdArrowForward, MdAutoAwesome, MdDeleteOutline, MdDownload, MdDragIndicator, MdSave } from 'react-icons/md'

import TextInputStyle from '../components/mantine/inputs/TextInput.module.css'
import ButtonStyle from '../components/mantine/buttons/PrimaryButton.module.css'
import NotificationStyle from '../components/mantine/notifications/Notification.module.css'

import { SideBar } from '../components/custom/sidebar/SideBar'
import { PageInfo } from '../components/custom/pageInfo/PageInfo'
import { PageContentContainer } from '../components/custom/pageContentContainer/PageContentContainer'
import {
	MealPlanPdfCanvasPreview,
	type MealPlanPdfBlobState,
	type MealPlanPdfNutritionistProfile,
} from '../components/custom/pdf/MealPlanPdfCanvasPreview'

import { useAuth } from '../auth/AuthContext'
import { APP_SIDEBAR_ITEMS } from '../lib/sidebarItems'

// MenuBuilderPage.tsx -> Tela principal de montagem do cardapio do paciente.
//
// RESUMO DO QUE ACONTECE AQUI
// 1) Carrega dados do paciente autenticado pelo backend.
// 2) Carrega alimentos da tabela TACO para selecao dos itens.
// 3) Permite montar grupos de refeicao manualmente (CRUD + reorder por drag and drop).
// 4) Abre modal de parametros da IA, envia prompt contextualizado e aplica retorno no formulario.
// 5) Exibe status de geracao em overlay e prepara area de preview/exportacao de PDF.
//
// FLUXO PRINCIPAL DA TELA
// Carregamento inicial -> Edicao manual do cardapio -> (Opcional) Geracao com IA -> Revisao final.

// TIPOS DE DOMINIO DA TELA:
// Contratos de paciente, estado interno do cardapio e formatos da resposta da IA.
type PatientMenuDataResponse = {
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

type MealItemState = {
	id: string
	foodId: string | null
	food: string
	quantity: string
	measure: string
	notes: string
}

type MealGroupState = {
	id: string
	name: string
	items: MealItemState[]
}

type MealItemEditableField = Exclude<keyof MealItemState, 'id' | 'foodId'>
type MealGroupDropPlacement = 'before' | 'after'

type TacoFoodEntry = {
	id: number
	description: string
}

type TacoFoodOption = {
	value: string
	label: string
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

type PlanPortionSummaryRow = {
	groupName: string
	portions: number
}

type PlanMicronutrientSummaryRow = {
	nutrientLabel: string
	offeredLabel: string
	earLabel: string
	rdaOrAiLabel: string
	ulLabel: string
	analysis: string
}

type PlanMacronutrientSummaryRow = {
	nutrientLabel: string
	offeredLabel: string
	recommendedLabel: string
	analysis: string
}

type PlanMealDistributionSummaryRow = {
	scheduleLabel: string
	mealLabel: string
	proteinG: number
	carbohydrateG: number
	lipidG: number
	caloriesKcal: number
	quantityG: number
}

type PlanInfographicRow = {
	nutrientLabel: string
	value: number
	unit: string
	referenceValue: number | null
	referenceLabel: string
	referenceKind: 'minimum' | 'maximum' | 'none'
	barPercentage: number
	isPositive: boolean
}

type PlanNutritionPreviewData = {
	portionRows: PlanPortionSummaryRow[]
	totalPlanKcal: number
	totalProteinG: number
	totalCarbohydrateG: number
	totalLipidG: number
	totalQuantityG: number
	totalMappedFoodsCount: number
	estimatedItemsCount: number
	micronutrientRows: PlanMicronutrientSummaryRow[]
	macronutrientRows: PlanMacronutrientSummaryRow[]
	mealDistributionRows: PlanMealDistributionSummaryRow[]
	infographicRows: PlanInfographicRow[]
}

type AiChatResponse = {
	model: string
	content: string
}

type AiGeneratedMealItem = {
	food: string
	quantity: string
	measure: string
	notes: string
}

type AiGeneratedMealGroup = {
	name: string
	items: AiGeneratedMealItem[]
}

type AiMappedMealGroupsResult = {
	mealGroups: MealGroupState[]
	unmatchedFoods: string[]
}

type AiPlanningFocus = 'balanced' | 'clinical' | 'variety' | 'performance'
type AiClinicalStrictness = 'high' | 'medium' | 'low'
type AiPreparationProfile = 'quick' | 'balanced' | 'elaborated'
type AiBudgetProfile = 'economic' | 'standard' | 'flexible'
type AiRecipeFocus = 'adherence' | 'variety' | 'protein' | 'satiety'

type AiGenerationSettingsState = {
	modelOverride: string | null
	planningFocus: AiPlanningFocus
	clinicalStrictness: AiClinicalStrictness
	preparationProfile: AiPreparationProfile
	budgetProfile: AiBudgetProfile
	maxItemsPerGroup: number
	preferredFoods: string
	restrictedFoods: string
	extraInstructions: string
}

type AiRecipeGenerationSettingsState = {
	modelOverride: string | null
	recipeFocus: AiRecipeFocus
	preparationProfile: AiPreparationProfile
	budgetProfile: AiBudgetProfile
	recipeCount: number
	maxIngredientsPerRecipe: number
	preferredFoods: string
	restrictedFoods: string
	extraInstructions: string
}

type AiModelsApiResponse = {
	model?: string
	availableModels?: string[]
	message?: string
}

type NutritionGuidanceState = {
	hydrationGoalMl: number | null
	mealRoutineGuidance: string
	foodQualityGuidance: string
	preparationGuidance: string
	behaviorGuidance: string
	symptomMonitoringGuidance: string
	restrictionsGuidance: string
	additionalGuidance: string
}

type NutritionGuidanceTextField = Exclude<keyof NutritionGuidanceState, 'hydrationGoalMl'>

type ParsedAiNutritionGuidanceResult = {
	guidance: Partial<NutritionGuidanceState>
	highlights: string[]
}

type RecipeSuggestionState = {
	id: string
	recipeName: string
	basedOnFoods: string
	ingredients: string
	preparationMethod: string
	yieldInfo: string
	portionQuantity: string
}

type RecipeSuggestionEditableField = Exclude<keyof RecipeSuggestionState, 'id'>

type SummaryMetricCardProps = {
	label: string
	value: string
}

type PatientMenuDraftApiResponse = {
	id: number
	patientId: number
	activeDataEntryStep: number
	mealGroups: MealGroupState[]
	nutritionGuidance: NutritionGuidanceState
	aiGuidanceHighlights: string[]
	recipeSuggestions: RecipeSuggestionState[]
	aiGenerationSettings: AiGenerationSettingsState
	aiRecipeGenerationSettings: AiRecipeGenerationSettingsState
	createdAt: string
	updatedAt: string
}

type SavePatientMenuDraftRequest = {
	activeDataEntryStep: number
	mealGroups: MealGroupState[]
	nutritionGuidance: NutritionGuidanceState
	aiGuidanceHighlights: string[]
	recipeSuggestions: RecipeSuggestionState[]
	aiGenerationSettings: AiGenerationSettingsState
	aiRecipeGenerationSettings: AiRecipeGenerationSettingsState
}

type MenuBuilderLocationState = {
	prefillMenuDraft?: PatientMenuDraftApiResponse
	prefillSource?: 'saved-history' | 'new-empty'
}

// CONFIGURACOES E CONSTANTES:
// Textos padrao, labels de opcoes e defaults usados em toda a pagina.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
const LOAD_PATIENT_ERROR_MESSAGE = 'Nao foi possivel carregar os dados do paciente.'
const LOAD_SAVED_MENU_ERROR_MESSAGE = 'Nao foi possivel carregar o cardapio salvo.'
const GENERATE_MENU_ERROR_MESSAGE = 'Nao foi possivel gerar o cardapio com IA.'
const SAVE_MENU_ERROR_MESSAGE = 'Nao foi possivel salvar o cardapio.'
const DEFAULT_MEAL_GROUP_LABELS = [
	'Cafe da manha',
	'Lanche da manha',
	'Almoco',
	'Lanche da tarde',
	'Jantar',
]
const AI_GENERATION_TOTAL_STEPS = 5
const AI_GENERATION_INITIAL_STATUS = 'Preparando dados do paciente e do cardapio...'
const AI_GUIDANCE_GENERATION_TOTAL_STEPS = 4
const AI_GUIDANCE_GENERATION_INITIAL_STATUS = 'Preparando dados clinicos e rascunho de orientacoes...'
const AI_RECIPE_GENERATION_TOTAL_STEPS = 4
const AI_RECIPE_GENERATION_INITIAL_STATUS = 'Consolidando alimentos selecionados para montar receitas...'
const AI_PLANNING_FOCUS_OPTIONS: Array<{ value: AiPlanningFocus; label: string }> = [
	{ value: 'balanced', label: 'Plano balanceado' },
	{ value: 'clinical', label: 'Prioridade clinica' },
	{ value: 'variety', label: 'Maior variedade' },
	{ value: 'performance', label: 'Performance esportiva' },
]
const AI_CLINICAL_STRICTNESS_OPTIONS: Array<{ value: AiClinicalStrictness; label: string }> = [
	{ value: 'high', label: 'Rigor clinico alto' },
	{ value: 'medium', label: 'Rigor clinico medio' },
	{ value: 'low', label: 'Rigor clinico flexivel' },
]
const AI_PREPARATION_PROFILE_OPTIONS: Array<{ value: AiPreparationProfile; label: string }> = [
	{ value: 'quick', label: 'Preparo rapido' },
	{ value: 'balanced', label: 'Preparo equilibrado' },
	{ value: 'elaborated', label: 'Pode elaborar' },
]
const AI_BUDGET_PROFILE_OPTIONS: Array<{ value: AiBudgetProfile; label: string }> = [
	{ value: 'economic', label: 'Economico' },
	{ value: 'standard', label: 'Padrao' },
	{ value: 'flexible', label: 'Flexivel' },
]
const AI_RECIPE_FOCUS_OPTIONS: Array<{ value: AiRecipeFocus; label: string }> = [
	{ value: 'adherence', label: 'Aderencia e praticidade' },
	{ value: 'variety', label: 'Maior variedade de preparos' },
	{ value: 'protein', label: 'Prioridade proteica' },
	{ value: 'satiety', label: 'Foco em saciedade' },
]
const AI_GENERATION_DEFAULT_SETTINGS: AiGenerationSettingsState = {
	modelOverride: null,
	planningFocus: 'balanced',
	clinicalStrictness: 'high',
	preparationProfile: 'balanced',
	budgetProfile: 'standard',
	maxItemsPerGroup: 4,
	preferredFoods: '',
	restrictedFoods: '',
	extraInstructions: '',
}
const AI_RECIPE_GENERATION_DEFAULT_SETTINGS: AiRecipeGenerationSettingsState = {
	modelOverride: null,
	recipeFocus: 'adherence',
	preparationProfile: 'balanced',
	budgetProfile: 'standard',
	recipeCount: 4,
	maxIngredientsPerRecipe: 7,
	preferredFoods: '',
	restrictedFoods: '',
	extraInstructions: '',
}
const DATA_ENTRY_STEPS_TOTAL = 3
const GENERATE_GUIDANCE_ERROR_MESSAGE = 'Nao foi possivel gerar orientacoes nutricionais com IA.'
const GENERATE_RECIPE_SUGGESTIONS_ERROR_MESSAGE = 'Nao foi possivel gerar sugestoes de receitas com IA.'
const NUTRITION_GUIDANCE_DEFAULT_STATE: NutritionGuidanceState = {
	hydrationGoalMl: null,
	mealRoutineGuidance: '',
	foodQualityGuidance: '',
	preparationGuidance: '',
	behaviorGuidance: '',
	symptomMonitoringGuidance: '',
	restrictionsGuidance: '',
	additionalGuidance: '',
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
const GOAL_LABELS: Record<string, string> = {
	'weight-loss': 'Emagrecimento',
	'muscle-gain': 'Ganho muscular',
	'dietary-reeducation': 'Reeducacao alimentar',
	'weight-maintenance': 'Manutencao de peso',
	'sports-performance': 'Performance esportiva',
	'metabolic-health': 'Saude metabolica',
	'intestinal-health': 'Saude intestinal',
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

// MAPEAMENTO DE CLASSES CSS:
// Padroniza aparencia dos campos e botoes usados em varios pontos da tela.
const textInputClassNames = {
	root: TextInputStyle.root,
	label: TextInputStyle.label,
	required: TextInputStyle.required,
	input: TextInputStyle.input,
	section: TextInputStyle.section,
}

const primaryButtonClassNames = {
	root: ButtonStyle.rootMenu,
	label: ButtonStyle.label,
}

const neutralButtonClassNames = {
	root: ButtonStyle.neutralRootMenu,
	label: ButtonStyle.neutralLabel,
}

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

function showWarningNotification(title: string, message: string) {
	notifications.show({
		title,
		message,
		color: 'yellow',
		withBorder: true,
		autoClose: 4000,
		classNames: notificationClassNames,
	})
}

// UTILITARIOS BASICOS:
// Funcoes de infraestrutura para URL, IDs e estruturas iniciais do formulario.
function buildApiUrl(path: string) {
	if (!API_BASE_URL) {
		return path
	}

	return `${API_BASE_URL}${path}`
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

function generateId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}

	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createMealItem(): MealItemState {
	return {
		id: generateId(),
		foodId: null,
		food: '',
		quantity: '',
		measure: '',
		notes: '',
	}
}

function createRecipeSuggestion(): RecipeSuggestionState {
	return {
		id: generateId(),
		recipeName: '',
		basedOnFoods: '',
		ingredients: '',
		preparationMethod: '',
		yieldInfo: '',
		portionQuantity: '',
	}
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
): PlanInfographicRow {
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
	mealGroups: MealGroupState[],
	tacoFoodById: Map<string, TacoFoodTableEntry>,
	patientGender: string,
): PlanNutritionPreviewData {
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

	const micronutrientRows: PlanMicronutrientSummaryRow[] = [
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

	const macronutrientRows: PlanMacronutrientSummaryRow[] = [
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

	const mealDistributionRows: PlanMealDistributionSummaryRow[] = mealGroups.map((group, groupIndex) => {
		const groupName = normalizeTextField(group.name) || `Refeicao ${groupIndex + 1}`
		const distributionTotals = mealDistributionAccumulator[groupIndex] ?? {
			proteinG: 0,
			carbohydrateG: 0,
			lipidG: 0,
			caloriesKcal: 0,
			quantityG: 0,
		}

		return {
			scheduleLabel: resolveDistributionSchedule(groupName, groupIndex),
			mealLabel: groupName,
			proteinG: distributionTotals.proteinG,
			carbohydrateG: distributionTotals.carbohydrateG,
			lipidG: distributionTotals.lipidG,
			caloriesKcal: distributionTotals.caloriesKcal,
			quantityG: distributionTotals.quantityG,
		}
	})

	const infographicRows: PlanInfographicRow[] = [
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

// CARREGAMENTO DA TACO:
// Converte estrutura bruta do JSON em opcoes de Select (value/label) ordenadas.
function buildTacoFoodOptions(source: unknown): TacoFoodOption[] {
	if (!Array.isArray(source)) {
		return []
	}

	const collator = new Intl.Collator('pt-BR')

	return source
		.flatMap((entry): TacoFoodOption[] => {
			if (typeof entry !== 'object' || entry === null) {
				return []
			}

			const parsedEntry = entry as Partial<TacoFoodEntry>
			if (!Number.isFinite(parsedEntry.id) || typeof parsedEntry.description !== 'string') {
				return []
			}

			const normalizedDescription = parsedEntry.description.trim()
			if (!normalizedDescription) {
				return []
			}

			return [{
				value: String(parsedEntry.id),
				label: normalizedDescription,
			}]
		})
			.sort((left, right) => collator.compare(left.label, right.label))
}

// NORMALIZACAO DE TEXTO:
// Garante comparacao consistente para busca/localizacao de alimentos.
function normalizeSearchText(value: string) {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function normalizeTextField(value: unknown) {
	if (typeof value !== 'string') {
		return ''
	}

	return value.trim().replace(/\s+/g, ' ')
}

function normalizeMultilineTextField(value: unknown) {
	if (typeof value !== 'string') {
		return ''
	}

	return value
		.replace(/\r/g, '')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.join('\n')
}

// PARSING DE RETORNO DA IA:
// Extrai JSON mesmo quando o modelo devolve ruido (markdown, texto extra etc.).
function extractJsonPayloadFromText(content: string): string | null {
	const trimmedContent = content.trim()
	if (!trimmedContent) {
		return null
	}

	const codeBlockMatch = trimmedContent.match(/```(?:json)?\s*([\s\S]*?)```/i)
	if (codeBlockMatch?.[1]) {
		return codeBlockMatch[1].trim()
	}

	const firstCurlyIndex = trimmedContent.indexOf('{')
	const lastCurlyIndex = trimmedContent.lastIndexOf('}')
	if (firstCurlyIndex >= 0 && lastCurlyIndex > firstCurlyIndex) {
		return trimmedContent.slice(firstCurlyIndex, lastCurlyIndex + 1)
	}

	if (trimmedContent.startsWith('[') && trimmedContent.endsWith(']')) {
		return trimmedContent
	}

	return null
}

// Normaliza a saida do modelo para o formato esperado pela tela (groups/items validados).
function parseAiGeneratedMealGroups(content: string): AiGeneratedMealGroup[] {
	const jsonPayload = extractJsonPayloadFromText(content)
	if (!jsonPayload) {
		return []
	}

	try {
		const parsed = JSON.parse(jsonPayload) as unknown
		const rawGroups = Array.isArray(parsed)
			? parsed
			: typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { groups?: unknown }).groups)
				? (parsed as { groups: unknown[] }).groups
				: []

		return rawGroups.flatMap((group): AiGeneratedMealGroup[] => {
			if (typeof group !== 'object' || group === null) {
				return []
			}

			const groupName = normalizeTextField((group as { name?: unknown }).name)
			const groupItems = (group as { items?: unknown }).items
			if (!groupName || !Array.isArray(groupItems)) {
				return []
			}

			const parsedItems = groupItems.flatMap((item): AiGeneratedMealItem[] => {
				if (typeof item !== 'object' || item === null) {
					return []
				}

				const food = normalizeTextField((item as { food?: unknown }).food)
				if (!food) {
					return []
				}

				return [{
					food,
					quantity: normalizeTextField((item as { quantity?: unknown }).quantity),
					measure: normalizeTextField((item as { measure?: unknown }).measure),
					notes: normalizeTextField((item as { notes?: unknown }).notes),
				}]
			})

			if (parsedItems.length === 0) {
				return []
			}

			return [{
				name: groupName,
				items: parsedItems,
			}]
		})
	} catch {
		return []
	}
}

function parseGuidanceHydrationGoal(value: unknown) {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		return Math.min(Math.max(Math.round(value), 1200), 7000)
	}

	if (typeof value === 'string') {
		const parsedValue = Number.parseInt(value.trim(), 10)
		if (Number.isFinite(parsedValue) && parsedValue > 0) {
			return Math.min(Math.max(Math.round(parsedValue), 1200), 7000)
		}
	}

	return null
}

function parseAiGeneratedNutritionGuidance(content: string): ParsedAiNutritionGuidanceResult | null {
	const jsonPayload = extractJsonPayloadFromText(content)
	if (!jsonPayload) {
		return null
	}

	try {
		const parsedPayload = JSON.parse(jsonPayload) as unknown
		if (typeof parsedPayload !== 'object' || parsedPayload === null) {
			return null
		}

		const rawPayload = parsedPayload as Record<string, unknown>
		const guidance: Partial<NutritionGuidanceState> = {}
		const hydrationGoalMl = parseGuidanceHydrationGoal(rawPayload.hydrationGoalMl)
		if (hydrationGoalMl !== null) {
			guidance.hydrationGoalMl = hydrationGoalMl
		}

		const textFields: NutritionGuidanceTextField[] = [
			'mealRoutineGuidance',
			'foodQualityGuidance',
			'preparationGuidance',
			'behaviorGuidance',
			'symptomMonitoringGuidance',
			'restrictionsGuidance',
			'additionalGuidance',
		]

		for (const field of textFields) {
			const normalizedValue = normalizeTextField(rawPayload[field])
			if (normalizedValue.length > 0) {
				guidance[field] = normalizedValue
			}
		}

		const highlights = Array.isArray(rawPayload.orientationHighlights)
			? rawPayload.orientationHighlights
				.filter((value): value is string => typeof value === 'string')
				.map((value) => normalizeTextField(value))
				.filter((value) => value.length > 0)
				.slice(0, 8)
			: []

		if (Object.keys(guidance).length === 0 && highlights.length === 0) {
			return null
		}

		return {
			guidance,
			highlights,
		}
	} catch {
		return null
	}
}

function summarizeGuidanceDraft(guidance: NutritionGuidanceState) {
	const lines: string[] = []

	if (guidance.hydrationGoalMl !== null) {
		lines.push(`- Meta de hidratacao atual: ${guidance.hydrationGoalMl} ml/dia.`)
	}

	const fieldLabels: Record<NutritionGuidanceTextField, string> = {
		mealRoutineGuidance: 'Rotina das refeicoes',
		foodQualityGuidance: 'Qualidade alimentar',
		preparationGuidance: 'Preparo/organizacao',
		behaviorGuidance: 'Comportamento alimentar',
		symptomMonitoringGuidance: 'Monitoramento de sintomas',
		restrictionsGuidance: 'Restricoes e alertas',
		additionalGuidance: 'Orientacoes adicionais',
	}

	for (const [field, label] of Object.entries(fieldLabels) as Array<[NutritionGuidanceTextField, string]>) {
		const value = normalizeTextField(guidance[field])
		if (value.length === 0) {
			continue
		}

		lines.push(`- ${label}: ${value}`)
	}

	return lines.length > 0 ? lines.join('\n') : '- Nenhuma orientacao preenchida manualmente ainda.'
}

function buildGuidanceGenerationPrompt(
	patient: PatientMenuDataResponse,
	currentMealGroups: MealGroupState[],
	currentGuidance: NutritionGuidanceState,
) {
	const age = calculateAgeFromIsoDate(patient.birthDate)
	const targetMealGroups = currentMealGroups.length > 0
		? currentMealGroups.map((group, index) => group.name.trim() || `Refeicao ${index + 1}`)
		: DEFAULT_MEAL_GROUP_LABELS
	const mealGroupsDescription = targetMealGroups
		.map((groupName, index) => `${index + 1}. ${groupName}`)
		.join('\n')
	const currentGuidanceDraft = summarizeGuidanceDraft(currentGuidance)
	const patientMedicalConditions = patient.medicalConditions.length > 0
		? patient.medicalConditions.map((condition) => formatMedicalCondition(condition)).join(', ')
		: 'Nenhuma'

	return [
		'Voce e um nutricionista clinico especialista em orientacoes para adesao ao plano alimentar.',
		'Objetivo: gerar orientacoes detalhadas, praticas e individualizadas para o paciente, em portugues do Brasil.',
		'Responda SOMENTE JSON valido, sem markdown, sem comentarios e sem texto fora do JSON.',
		'Formato obrigatorio:',
		'{"hydrationGoalMl":3200,"mealRoutineGuidance":"...","foodQualityGuidance":"...","preparationGuidance":"...","behaviorGuidance":"...","symptomMonitoringGuidance":"...","restrictionsGuidance":"...","additionalGuidance":"...","orientationHighlights":["...","...","..."]}',
		'Regras obrigatorias:',
		'- Cada campo textual deve conter orientacoes concretas, detalhadas e acionaveis para o paciente.',
		'- orientationHighlights deve conter de 4 a 8 bullets, cada um com uma frase completa e objetiva.',
		'- Considerar objetivo, condicoes clinicas, atividade fisica e refeicoes ja planejadas.',
		'- Evitar linguagem vaga; sugerir frequencia, exemplos e estrategia de adesao.',
		'- Nao recomendar qualquer conduta medicamentosa.',
		'Grupos de refeicao do plano atual:',
		mealGroupsDescription,
		'Rascunho atual do nutricionista (use como base e melhore com detalhes):',
		currentGuidanceDraft,
		'Dados do paciente:',
		`- Nome: ${patient.name}`,
		`- Sexo: ${formatGender(patient.gender)}`,
		`- Idade: ${age === null ? '-' : `${age} anos`}`,
		`- Peso: ${patient.weight.toFixed(1)} kg`,
		`- Altura: ${patient.height.toFixed(0)} cm`,
		`- IMC: ${patient.bmi.toFixed(1)}`,
		`- Objetivos: ${formatGoalList(patient.goal) || '-'}`,
		`- Atividade: ${formatActivityLevel(patient.activityLevel)}`,
		`- Condicoes medicas: ${patientMedicalConditions}`,
		`- TMB: ${Math.round(patient.bmr)} kcal`,
		`- TDEE: ${Math.round(patient.tdee)} kcal`,
		'Retorne apenas o JSON final.',
	].join('\n')
}

function ensureGuidanceSentence(value: string) {
	const normalizedValue = normalizeTextField(value)
	if (normalizedValue.length === 0) {
		return ''
	}

	return /[.!?]$/.test(normalizedValue) ? normalizedValue : `${normalizedValue}.`
}

function buildNutritionGuidanceTips(
	patient: PatientMenuDataResponse,
	guidance: NutritionGuidanceState,
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

function extractSelectedFoodsFromMealGroups(currentMealGroups: MealGroupState[]) {
	const uniqueFoods = new Set<string>()

	for (const group of currentMealGroups) {
		for (const item of group.items) {
			const normalizedFood = normalizeTextField(item.food)
			if (normalizedFood.length > 0) {
				uniqueFoods.add(normalizedFood)
			}
		}
	}

	return Array.from(uniqueFoods)
}

function summarizeRecipeSuggestionsDraft(recipes: RecipeSuggestionState[]) {
	if (recipes.length === 0) {
		return '- Nenhuma receita preenchida ainda.'
	}

	return recipes
		.slice(0, 8)
		.map((recipe, index) => {
			const recipeName = normalizeTextField(recipe.recipeName) || `Receita ${index + 1}`
			const basedOnFoods = normalizeTextField(recipe.basedOnFoods)
			const yieldInfo = normalizeTextField(recipe.yieldInfo)
			const portionQuantity = normalizeTextField(recipe.portionQuantity)

			return [
				`- ${recipeName}`,
				basedOnFoods ? `base: ${basedOnFoods}` : '',
				yieldInfo ? `rendimento: ${yieldInfo}` : '',
				portionQuantity ? `quantidade: ${portionQuantity}` : '',
			]
				.filter((value) => value.length > 0)
				.join(' | ')
		})
		.join('\n')
}

function parseAiGeneratedRecipeSuggestions(content: string): RecipeSuggestionState[] {
	const jsonPayload = extractJsonPayloadFromText(content)
	if (!jsonPayload) {
		return []
	}

	try {
		const parsedPayload = JSON.parse(jsonPayload) as unknown
		const rawRecipes = Array.isArray(parsedPayload)
			? parsedPayload
			: typeof parsedPayload === 'object' && parsedPayload !== null && Array.isArray((parsedPayload as { recipes?: unknown[] }).recipes)
				? (parsedPayload as { recipes: unknown[] }).recipes
				: []

		const recipes = rawRecipes.flatMap((recipe): RecipeSuggestionState[] => {
			if (typeof recipe !== 'object' || recipe === null) {
				return []
			}

			const rawRecipe = recipe as Record<string, unknown>
			const recipeName = normalizeTextField(rawRecipe.recipeName ?? rawRecipe.name ?? rawRecipe.receita ?? rawRecipe.title)
			if (recipeName.length === 0) {
				return []
			}

			const basedOnFoods = normalizeTextField(rawRecipe.basedOnFoods ?? rawRecipe.baseFoods ?? rawRecipe.alimentosBase)
			const ingredients = normalizeMultilineTextField(rawRecipe.ingredients ?? rawRecipe.ingredientes)
			const preparationMethod = normalizeMultilineTextField(rawRecipe.preparationMethod ?? rawRecipe.preparation ?? rawRecipe.modoPreparo)
			const yieldInfo = normalizeTextField(rawRecipe.yieldInfo ?? rawRecipe.yield ?? rawRecipe.rendimento)
			const portionQuantity = normalizeTextField(rawRecipe.portionQuantity ?? rawRecipe.quantityPerPortion ?? rawRecipe.quantidadePorPorcao ?? rawRecipe.quantidade)

			return [{
				id: generateId(),
				recipeName,
				basedOnFoods,
				ingredients,
				preparationMethod,
				yieldInfo,
				portionQuantity,
			}]
		})

		const uniqueRecipes: RecipeSuggestionState[] = []
		const uniqueNames = new Set<string>()
		for (const recipe of recipes) {
			const normalizedRecipeName = normalizeSearchText(recipe.recipeName)
			if (normalizedRecipeName.length === 0 || uniqueNames.has(normalizedRecipeName)) {
				continue
			}

			uniqueNames.add(normalizedRecipeName)
			uniqueRecipes.push(recipe)
		}

		return uniqueRecipes.slice(0, 10)
	} catch {
		return []
	}
}

function buildAiRecipeSettingsPrompt(settings: AiRecipeGenerationSettingsState) {
	const recipeFocusPromptByValue: Record<AiRecipeFocus, string> = {
		adherence: 'Priorizar receitas simples, replicaveis e faceis de manter no dia a dia.',
		variety: 'Priorizar diversidade de tecnicas e combinacoes para evitar monotonia alimentar.',
		protein: 'Priorizar receitas com fonte proteica relevante em relacao ao objetivo do paciente.',
		satiety: 'Priorizar receitas com fibras e composicao que favoreca saciedade.',
	}

	const preparationPromptByValue: Record<AiPreparationProfile, string> = {
		quick: 'Dar preferencia para preparacoes simples e rapidas.',
		balanced: 'Combinar preparacoes simples com algumas intermediarias.',
		elaborated: 'Pode sugerir preparos mais elaborados quando fizer sentido.',
	}

	const budgetPromptByValue: Record<AiBudgetProfile, string> = {
		economic: 'Priorizar ingredientes de menor custo e facil acesso.',
		standard: 'Usar perfil de custo padrao.',
		flexible: 'Permitir ingredientes de custo mais amplo.',
	}

	const preferredFoods = parseCommaSeparatedList(settings.preferredFoods)
	const restrictedFoods = parseCommaSeparatedList(settings.restrictedFoods)
	const recipeCount = Math.min(Math.max(Math.round(settings.recipeCount), 2), 8)
	const maxIngredientsPerRecipe = Math.min(Math.max(Math.round(settings.maxIngredientsPerRecipe), 3), 12)
	const extraInstructions = settings.extraInstructions.trim()

	const promptLines = [
		`- Foco das receitas: ${recipeFocusPromptByValue[settings.recipeFocus]}`,
		`- Perfil de preparo: ${preparationPromptByValue[settings.preparationProfile]}`,
		`- Perfil de orcamento: ${budgetPromptByValue[settings.budgetProfile]}`,
		`- Quantidade alvo de receitas: ${recipeCount}.`,
		`- Maximo de ingredientes principais por receita: ${maxIngredientsPerRecipe}.`,
	]

	if (preferredFoods.length > 0) {
		promptLines.push(`- Preferir ingredientes/alimentos: ${preferredFoods.join(', ')}.`)
	}

	if (restrictedFoods.length > 0) {
		promptLines.push(`- Evitar ingredientes/alimentos: ${restrictedFoods.join(', ')}.`)
	}

	if (extraInstructions.length > 0) {
		promptLines.push(`- Instrucoes extras do nutricionista: ${extraInstructions}`)
	}

	return {
		recipeCount,
		maxIngredientsPerRecipe,
		promptLines,
	}
}

function buildRecipeSuggestionsGenerationPrompt(
	patient: PatientMenuDataResponse,
	currentMealGroups: MealGroupState[],
	currentGuidance: NutritionGuidanceState,
	currentRecipes: RecipeSuggestionState[],
	settings: AiRecipeGenerationSettingsState,
) {
	const age = calculateAgeFromIsoDate(patient.birthDate)
	const selectedFoods = extractSelectedFoodsFromMealGroups(currentMealGroups)
	const foodsList = selectedFoods.length > 0
		? selectedFoods.map((foodName, index) => `${index + 1}. ${foodName}`).join('\n')
		: '- Nenhum alimento selecionado.'
	const currentDraft = summarizeRecipeSuggestionsDraft(currentRecipes)
	const currentGuidanceDraft = summarizeGuidanceDraft(currentGuidance)
	const patientMedicalConditions = patient.medicalConditions.length > 0
		? patient.medicalConditions.map((condition) => formatMedicalCondition(condition)).join(', ')
		: 'Nenhuma'
	const recipeSettingsPrompt = buildAiRecipeSettingsPrompt(settings)

	return [
		'Voce e um nutricionista especialista em montar receitas praticas para adesao alimentar.',
		'Objetivo: gerar sugestoes de receitas claras e aplicaveis usando os alimentos ja selecionados no plano.',
		'Responda SOMENTE JSON valido, sem markdown e sem texto fora do JSON.',
		'Formato obrigatorio:',
		'{"recipes":[{"recipeName":"...","basedOnFoods":"...","ingredients":"Linha 1\\nLinha 2","preparationMethod":"...","yieldInfo":"...","portionQuantity":"..."}]}',
		'Regras obrigatorias:',
		`- Gerar exatamente ${recipeSettingsPrompt.recipeCount} receitas (array "recipes" com ${recipeSettingsPrompt.recipeCount} objetos).`,
		`- Cada receita deve ter no maximo ${recipeSettingsPrompt.maxIngredientsPerRecipe} ingredientes principais.`,
		'- Priorizar alimentos da lista fornecida em basedOnFoods.',
		'- ingredients deve ser direto e objetivo, em linhas curtas.',
		'- preparationMethod deve ser pratico e em linguagem simples para o paciente.',
		'- yieldInfo e portionQuantity devem ser concretos.',
		'- Evitar recomendacoes medicamentosas.',
		'Parametros definidos pelo nutricionista:',
		...recipeSettingsPrompt.promptLines,
		'Alimentos selecionados no plano alimentar:',
		foodsList,
		'Resumo atual do cardapio por refeicao:',
		summarizeCurrentDraft(currentMealGroups),
		'Orientacoes clinicas ja definidas pelo nutricionista:',
		currentGuidanceDraft,
		'Rascunho atual de receitas (se houver, melhorar e complementar):',
		currentDraft,
		'Dados do paciente:',
		`- Nome: ${patient.name}`,
		`- Sexo: ${formatGender(patient.gender)}`,
		`- Idade: ${age === null ? '-' : `${age} anos`}`,
		`- Peso: ${patient.weight.toFixed(1)} kg`,
		`- Altura: ${patient.height.toFixed(0)} cm`,
		`- IMC: ${patient.bmi.toFixed(1)}`,
		`- Objetivos: ${formatGoalList(patient.goal) || '-'}`,
		`- Atividade: ${formatActivityLevel(patient.activityLevel)}`,
		`- Condicoes medicas: ${patientMedicalConditions}`,
		'Retorne apenas o JSON final.',
	].join('\n')
}

// MAPEAMENTO IA -> TACO:
// Faz correspondencia aproximada do alimento retornado pela IA para o catalogo local.
function findBestTacoFoodOption(foodName: string, tacoFoodOptions: TacoFoodOption[]): TacoFoodOption | null {
	const normalizedFoodName = normalizeSearchText(foodName)
	if (!normalizedFoodName) {
		return null
	}

	const foodTokens = normalizedFoodName.split(' ').filter((token) => token.length > 0)
	let bestMatch: { option: TacoFoodOption; score: number } | null = null

	for (const option of tacoFoodOptions) {
		const normalizedOptionLabel = normalizeSearchText(option.label)
		if (!normalizedOptionLabel) {
			continue
		}

		if (normalizedOptionLabel === normalizedFoodName) {
			return option
		}

		let score = 0
		if (normalizedOptionLabel.includes(normalizedFoodName)) {
			score += 4
		}
		if (normalizedFoodName.includes(normalizedOptionLabel)) {
			score += 2
		}

		const optionTokens = normalizedOptionLabel.split(' ').filter((token) => token.length > 0)
		const tokenOverlap = foodTokens.reduce(
			(count, token) => (optionTokens.includes(token) ? count + 1 : count),
			0,
		)
		score += tokenOverlap

		if (score > 0 && (!bestMatch || score > bestMatch.score)) {
			bestMatch = { option, score }
		}
	}

	return bestMatch?.option ?? null
}

// CONVERSAO DO JSON DA IA PARA ESTADO DA TELA:
// Preserva itens validos e registra alimentos nao mapeados para revisao manual.
function mapAiGroupsToMealGroups(
	aiGroups: AiGeneratedMealGroup[],
	tacoFoodOptions: TacoFoodOption[],
): AiMappedMealGroupsResult {
	const unmatchedFoods = new Set<string>()

	const mappedGroups = aiGroups.map((group) => {
		const mappedItems = group.items.map((item) => {
			const matchedFood = findBestTacoFoodOption(item.food, tacoFoodOptions)
			if (!matchedFood) {
				unmatchedFoods.add(item.food)
			}

			const notes = [
				item.notes,
				!matchedFood ? `Sugestao IA: ${item.food}` : '',
			]
				.filter((value) => value.trim().length > 0)
				.join(' | ')

			return {
				id: generateId(),
				foodId: matchedFood?.value ?? null,
				food: matchedFood?.label ?? item.food,
				quantity: item.quantity,
				measure: item.measure,
				notes,
			}
		})

		return {
			id: generateId(),
			name: group.name,
			items: mappedItems.length > 0 ? mappedItems : [createMealItem()],
		}
	})

	return {
		mealGroups: mappedGroups.length > 0 ? mappedGroups : getInitialMealGroups(),
		unmatchedFoods: Array.from(unmatchedFoods),
	}
}

// FABRICAS DE ESTADO:
// Helpers para criar grupos/itens e ordenar grupos no drag and drop.
function createMealGroup(name: string): MealGroupState {
	return {
		id: generateId(),
		name,
		items: [createMealItem()],
	}
}

function getInitialMealGroups() {
	return DEFAULT_MEAL_GROUP_LABELS.map((label) => createMealGroup(label))
}

function normalizeMealGroupsFromApi(source: MealGroupState[] | null | undefined): MealGroupState[] {
	if (!Array.isArray(source) || source.length === 0) {
		return getInitialMealGroups()
	}

	const normalizedGroups = source.map((group) => {
		const normalizedGroupName = typeof group.name === 'string' ? group.name : ''
		const normalizedItems = Array.isArray(group.items)
			? group.items.map((item) => ({
				id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : generateId(),
				foodId: typeof item.foodId === 'string' && item.foodId.trim().length > 0 ? item.foodId : null,
				food: typeof item.food === 'string' ? item.food : '',
				quantity: typeof item.quantity === 'string' ? item.quantity : '',
				measure: typeof item.measure === 'string' ? item.measure : '',
				notes: typeof item.notes === 'string' ? item.notes : '',
			}))
			: []

		return {
			id: typeof group.id === 'string' && group.id.trim().length > 0 ? group.id : generateId(),
			name: normalizedGroupName,
			items: normalizedItems.length > 0 ? normalizedItems : [createMealItem()],
		}
	})

	return normalizedGroups.length > 0 ? normalizedGroups : getInitialMealGroups()
}

function normalizeNutritionGuidanceFromApi(source: NutritionGuidanceState | null | undefined): NutritionGuidanceState {
	if (!source || typeof source !== 'object') {
		return NUTRITION_GUIDANCE_DEFAULT_STATE
	}

	return {
		hydrationGoalMl: typeof source.hydrationGoalMl === 'number' && Number.isFinite(source.hydrationGoalMl)
			? Math.min(Math.max(Math.round(source.hydrationGoalMl), 1200), 7000)
			: null,
		mealRoutineGuidance: typeof source.mealRoutineGuidance === 'string' ? source.mealRoutineGuidance : '',
		foodQualityGuidance: typeof source.foodQualityGuidance === 'string' ? source.foodQualityGuidance : '',
		preparationGuidance: typeof source.preparationGuidance === 'string' ? source.preparationGuidance : '',
		behaviorGuidance: typeof source.behaviorGuidance === 'string' ? source.behaviorGuidance : '',
		symptomMonitoringGuidance: typeof source.symptomMonitoringGuidance === 'string' ? source.symptomMonitoringGuidance : '',
		restrictionsGuidance: typeof source.restrictionsGuidance === 'string' ? source.restrictionsGuidance : '',
		additionalGuidance: typeof source.additionalGuidance === 'string' ? source.additionalGuidance : '',
	}
}

function normalizeRecipeSuggestionsFromApi(source: RecipeSuggestionState[] | null | undefined): RecipeSuggestionState[] {
	if (!Array.isArray(source) || source.length === 0) {
		return [createRecipeSuggestion()]
	}

	const normalizedRecipes = source.map((recipe) => ({
		id: typeof recipe.id === 'string' && recipe.id.trim().length > 0 ? recipe.id : generateId(),
		recipeName: typeof recipe.recipeName === 'string' ? recipe.recipeName : '',
		basedOnFoods: typeof recipe.basedOnFoods === 'string' ? recipe.basedOnFoods : '',
		ingredients: typeof recipe.ingredients === 'string' ? recipe.ingredients : '',
		preparationMethod: typeof recipe.preparationMethod === 'string' ? recipe.preparationMethod : '',
		yieldInfo: typeof recipe.yieldInfo === 'string' ? recipe.yieldInfo : '',
		portionQuantity: typeof recipe.portionQuantity === 'string' ? recipe.portionQuantity : '',
	}))

	return normalizedRecipes.length > 0 ? normalizedRecipes : [createRecipeSuggestion()]
}

function normalizeAiGuidanceHighlightsFromApi(source: string[] | null | undefined): string[] {
	if (!Array.isArray(source)) {
		return []
	}

	return source
		.filter((highlight): highlight is string => typeof highlight === 'string')
		.map((highlight) => highlight.trim())
		.filter((highlight) => highlight.length > 0)
}

function normalizeAiGenerationSettingsFromApi(source: AiGenerationSettingsState | null | undefined): AiGenerationSettingsState {
	if (!source || typeof source !== 'object') {
		return AI_GENERATION_DEFAULT_SETTINGS
	}

	const resolvedPlanningFocus = AI_PLANNING_FOCUS_OPTIONS.some((option) => option.value === source.planningFocus)
		? source.planningFocus
		: AI_GENERATION_DEFAULT_SETTINGS.planningFocus
	const resolvedClinicalStrictness = AI_CLINICAL_STRICTNESS_OPTIONS.some((option) => option.value === source.clinicalStrictness)
		? source.clinicalStrictness
		: AI_GENERATION_DEFAULT_SETTINGS.clinicalStrictness
	const resolvedPreparationProfile = AI_PREPARATION_PROFILE_OPTIONS.some((option) => option.value === source.preparationProfile)
		? source.preparationProfile
		: AI_GENERATION_DEFAULT_SETTINGS.preparationProfile
	const resolvedBudgetProfile = AI_BUDGET_PROFILE_OPTIONS.some((option) => option.value === source.budgetProfile)
		? source.budgetProfile
		: AI_GENERATION_DEFAULT_SETTINGS.budgetProfile

	return {
		modelOverride: typeof source.modelOverride === 'string' && source.modelOverride.trim().length > 0
			? source.modelOverride
			: null,
		planningFocus: resolvedPlanningFocus,
		clinicalStrictness: resolvedClinicalStrictness,
		preparationProfile: resolvedPreparationProfile,
		budgetProfile: resolvedBudgetProfile,
		maxItemsPerGroup: typeof source.maxItemsPerGroup === 'number' && Number.isFinite(source.maxItemsPerGroup)
			? Math.min(Math.max(Math.round(source.maxItemsPerGroup), 2), 6)
			: AI_GENERATION_DEFAULT_SETTINGS.maxItemsPerGroup,
		preferredFoods: typeof source.preferredFoods === 'string' ? source.preferredFoods : '',
		restrictedFoods: typeof source.restrictedFoods === 'string' ? source.restrictedFoods : '',
		extraInstructions: typeof source.extraInstructions === 'string' ? source.extraInstructions : '',
	}
}

function normalizeAiRecipeGenerationSettingsFromApi(
	source: AiRecipeGenerationSettingsState | null | undefined,
): AiRecipeGenerationSettingsState {
	if (!source || typeof source !== 'object') {
		return AI_RECIPE_GENERATION_DEFAULT_SETTINGS
	}

	const resolvedRecipeFocus = AI_RECIPE_FOCUS_OPTIONS.some((option) => option.value === source.recipeFocus)
		? source.recipeFocus
		: AI_RECIPE_GENERATION_DEFAULT_SETTINGS.recipeFocus
	const resolvedPreparationProfile = AI_PREPARATION_PROFILE_OPTIONS.some((option) => option.value === source.preparationProfile)
		? source.preparationProfile
		: AI_RECIPE_GENERATION_DEFAULT_SETTINGS.preparationProfile
	const resolvedBudgetProfile = AI_BUDGET_PROFILE_OPTIONS.some((option) => option.value === source.budgetProfile)
		? source.budgetProfile
		: AI_RECIPE_GENERATION_DEFAULT_SETTINGS.budgetProfile

	return {
		modelOverride: typeof source.modelOverride === 'string' && source.modelOverride.trim().length > 0
			? source.modelOverride
			: null,
		recipeFocus: resolvedRecipeFocus,
		preparationProfile: resolvedPreparationProfile,
		budgetProfile: resolvedBudgetProfile,
		recipeCount: typeof source.recipeCount === 'number' && Number.isFinite(source.recipeCount)
			? Math.min(Math.max(Math.round(source.recipeCount), 2), 8)
			: AI_RECIPE_GENERATION_DEFAULT_SETTINGS.recipeCount,
		maxIngredientsPerRecipe: typeof source.maxIngredientsPerRecipe === 'number' && Number.isFinite(source.maxIngredientsPerRecipe)
			? Math.min(Math.max(Math.round(source.maxIngredientsPerRecipe), 3), 12)
			: AI_RECIPE_GENERATION_DEFAULT_SETTINGS.maxIngredientsPerRecipe,
		preferredFoods: typeof source.preferredFoods === 'string' ? source.preferredFoods : '',
		restrictedFoods: typeof source.restrictedFoods === 'string' ? source.restrictedFoods : '',
		extraInstructions: typeof source.extraInstructions === 'string' ? source.extraInstructions : '',
	}
}

function reorderMealGroups(
	groups: MealGroupState[],
	sourceGroupId: string,
	targetGroupId: string,
	placement: MealGroupDropPlacement,
) {
	const sourceIndex = groups.findIndex((group) => group.id === sourceGroupId)
	const targetIndex = groups.findIndex((group) => group.id === targetGroupId)
	if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
		return groups
	}

	const nextGroups = [...groups]
	const [sourceGroup] = nextGroups.splice(sourceIndex, 1)

	let insertionIndex = targetIndex
	if (placement === 'before') {
		insertionIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
	} else {
		insertionIndex = sourceIndex < targetIndex ? targetIndex : targetIndex + 1
	}

	const boundedInsertionIndex = Math.min(Math.max(insertionIndex, 0), nextGroups.length)
	nextGroups.splice(boundedInsertionIndex, 0, sourceGroup)
	return nextGroups
}

// FORMATADORES DE EXIBICAO:
// Transformam dados clinicos crus para labels legiveis no resumo da UI.
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

	return `${parsedDate.toLocaleDateString('pt-BR')} ${parsedDate.toLocaleTimeString('pt-BR', {
		hour: '2-digit',
		minute: '2-digit',
	})}`
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
		sedentary: 'Sedentario',
		light: 'Leve',
		moderate: 'Moderado',
		intense: 'Intenso',
		'very-intense': 'Muito intenso',
	}

	return labels[activityLevel] ?? activityLevel
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

function formatGoalList(goalList: string) {
	return goalList
		.split(',')
		.map((goal) => goal.trim().toLowerCase())
		.filter((goal) => goal.length > 0)
		.map((goal) => GOAL_LABELS[goal] ?? toStartCase(goal))
		.join(', ')
}

function formatTdee(tdee: number) {
	if (!Number.isFinite(tdee)) {
		return '-'
	}

	return `${Math.round(tdee)} kcal`
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

// HEURISTICAS DE DISTRIBUICAO ENERGETICA:
// Define pesos por grupo de refeicao para orientar a IA no prompt.
function getMealGroupWeight(groupName: string) {
	const normalizedGroupName = normalizeSearchText(groupName)

	if (normalizedGroupName.includes('cafe da manha')) {
		return 2.2
	}

	if (normalizedGroupName.includes('lanche da manha')) {
		return 1.0
	}

	if (normalizedGroupName.includes('almoco')) {
		return 3.0
	}

	if (normalizedGroupName.includes('lanche da tarde')) {
		return 1.2
	}

	if (normalizedGroupName.includes('jantar')) {
		return 2.5
	}

	if (normalizedGroupName.includes('ceia')) {
		return 0.8
	}

	if (normalizedGroupName.includes('pre treino')) {
		return 1.1
	}

	if (normalizedGroupName.includes('pos treino')) {
		return 1.4
	}

	return 1.4
}

function buildEnergyTargetsByGroup(groupNames: string[], tdee: number) {
	const safeTdee = Number.isFinite(tdee) && tdee > 0 ? tdee : 2000
	const weightedGroups = groupNames.map((groupName) => ({
		name: groupName,
		weight: getMealGroupWeight(groupName),
	}))

	const totalWeight = weightedGroups.reduce((sum, group) => sum + group.weight, 0)
	if (totalWeight <= 0) {
		return groupNames.map((groupName) => ({
			name: groupName,
			percentage: Number((100 / Math.max(groupNames.length, 1)).toFixed(1)),
			kcalTarget: Math.round(safeTdee / Math.max(groupNames.length, 1)),
		}))
	}

	return weightedGroups.map((group) => {
		const percentage = Number(((group.weight / totalWeight) * 100).toFixed(1))
		const kcalTarget = Math.round((safeTdee * percentage) / 100)

		return {
			name: group.name,
			percentage,
			kcalTarget,
		}
	})
}

// CONTEXTO PARA O PROMPT:
// Resume o rascunho atual e cria regras clinicas para aumentar assertividade da IA.
function summarizeCurrentDraft(mealGroups: MealGroupState[]) {
	if (mealGroups.length === 0) {
		return '- Nenhum grupo preenchido ainda.'
	}

	return mealGroups.map((group, groupIndex) => {
		const resolvedGroupName = group.name.trim() || `Refeicao ${groupIndex + 1}`
		const foods = group.items
			.map((item) => item.food.trim())
			.filter((foodName) => foodName.length > 0)
			.slice(0, 5)

		if (foods.length === 0) {
			return `- ${resolvedGroupName}: sem alimentos definidos.`
		}

		return `- ${resolvedGroupName}: ${foods.join(', ')}.`
		}).join('\n')
}

// REGRAS CLINICAS:
// Traduz condicoes medicas e objetivos em restricoes/prioridades para o modelo.
function buildClinicalRules(patient: PatientMenuDataResponse) {
	const normalizedConditions = patient.medicalConditions
		.map((condition) => condition.trim().toLowerCase())
		.filter((condition) => condition.length > 0)

	const rules: string[] = []

	if (normalizedConditions.some((condition) => condition.includes('diabetes'))) {
		rules.push('- Diabetes: evitar acucares simples, sucos adocicados e sobremesas com alto indice glicemico.')
	}

	if (normalizedConditions.some((condition) => condition.includes('hypertension') || condition.includes('hipertensao'))) {
		rules.push('- Hipertensao: reduzir sodio, embutidos e ultraprocessados.')
	}

	if (normalizedConditions.some((condition) => condition.includes('dyslipidemia') || condition.includes('dislipidemia'))) {
		rules.push('- Dislipidemia: priorizar fibras e gorduras insaturadas, reduzir frituras e gordura saturada.')
	}

	if (normalizedConditions.some((condition) => condition.includes('kidney') || condition.includes('renal'))) {
		rules.push('- Doenca renal: evitar excesso de sodio e proteina concentrada; manter sugestoes moderadas.')
	}

	if (normalizedConditions.some((condition) => condition.includes('liver') || condition.includes('hepatica'))) {
		rules.push('- Doenca hepatica: evitar alcool e excesso de gordura em uma unica refeicao.')
	}

	const normalizedGoal = patient.goal.toLowerCase()
	if (normalizedGoal.includes('weight-loss') || normalizedGoal.includes('emagrec')) {
		rules.push('- Objetivo emagrecimento: priorizar saciedade, vegetais e proteina magra, com densidade energetica moderada.')
	}

	if (normalizedGoal.includes('muscle-gain') || normalizedGoal.includes('ganho muscular')) {
		rules.push('- Objetivo ganho muscular: incluir fonte proteica em todas as refeicoes e carboidratos estrategicos.')
	}

	if (rules.length === 0) {
		rules.push('- Sem restricoes clinicas especificas alem do perfil geral do paciente.')
	}

	return rules
}

// PARAMETROS DO MODAL DA IA:
// Normaliza selecoes do nutricionista para linhas objetivas no prompt.
function parseCommaSeparatedList(value: string) {
	return value
		.split(',')
		.map((token) => token.trim())
		.filter((token) => token.length > 0)
}

function buildAiSettingsPrompt(settings: AiGenerationSettingsState) {
	const focusPromptByValue: Record<AiPlanningFocus, string> = {
		balanced: 'Balancear adequacao clinica, praticidade e variedade.',
		clinical: 'Priorizar seguranca clinica e controle dietetico.',
		variety: 'Priorizar diversidade de alimentos ao longo do dia.',
		performance: 'Priorizar energia para treino e recuperacao.',
	}

	const strictnessPromptByValue: Record<AiClinicalStrictness, string> = {
		high: 'Seguir restricoes clinicas com rigidez alta.',
		medium: 'Seguir restricoes clinicas com rigidez moderada.',
		low: 'Seguir restricoes clinicas com flexibilidade controlada.',
	}

	const preparationPromptByValue: Record<AiPreparationProfile, string> = {
		quick: 'Dar preferencia para preparacoes simples e rapidas.',
		balanced: 'Combinar preparacoes simples com algumas intermediarias.',
		elaborated: 'Pode sugerir preparos mais elaborados quando fizer sentido.',
	}

	const budgetPromptByValue: Record<AiBudgetProfile, string> = {
		economic: 'Priorizar alimentos de menor custo e facil acesso.',
		standard: 'Usar perfil de custo padrao.',
		flexible: 'Permitir opcoes de custo mais amplo.',
	}

	const preferredFoods = parseCommaSeparatedList(settings.preferredFoods)
	const restrictedFoods = parseCommaSeparatedList(settings.restrictedFoods)
	const maxItemsPerGroup = Math.min(Math.max(Math.round(settings.maxItemsPerGroup), 2), 6)
	const extraInstructions = settings.extraInstructions.trim()

	const promptLines = [
		`- Foco do planejamento: ${focusPromptByValue[settings.planningFocus]}`,
		`- Rigor clinico: ${strictnessPromptByValue[settings.clinicalStrictness]}`,
		`- Perfil de preparo: ${preparationPromptByValue[settings.preparationProfile]}`,
		`- Perfil de orcamento: ${budgetPromptByValue[settings.budgetProfile]}`,
		`- Limite maximo de itens por grupo: ${maxItemsPerGroup}.`,
	]

	if (preferredFoods.length > 0) {
		promptLines.push(`- Preferir alimentos: ${preferredFoods.join(', ')}.`)
	}

	if (restrictedFoods.length > 0) {
		promptLines.push(`- Evitar alimentos: ${restrictedFoods.join(', ')}.`)
	}

	if (extraInstructions.length > 0) {
		promptLines.push(`- Instrucoes extras do nutricionista: ${extraInstructions}`)
	}

	return {
		maxItemsPerGroup,
		promptLines,
	}
}

// PROMPT FINAL PARA GERACAO:
// Combina dados do paciente, grupos atuais, regras clinicas e preferencias do nutricionista.
function buildMenuGenerationPrompt(
	patient: PatientMenuDataResponse,
	currentMealGroups: MealGroupState[],
	settings: AiGenerationSettingsState,
) {
	const age = calculateAgeFromIsoDate(patient.birthDate)
	const patientMedicalConditions = patient.medicalConditions.length > 0
		? patient.medicalConditions.map((condition) => formatMedicalCondition(condition)).filter((condition) => condition.length > 0).join(', ')
		: 'Nenhuma'
	const targetMealGroups = currentMealGroups.length > 0
		? currentMealGroups.map((group, index) => group.name.trim() || `Refeicao ${index + 1}`)
		: DEFAULT_MEAL_GROUP_LABELS
	const targetMealGroupsDescription = targetMealGroups
		.map((groupName, index) => `${index + 1}. ${groupName}`)
		.join('\n')
	const energyTargets = buildEnergyTargetsByGroup(targetMealGroups, patient.tdee)
	const energyTargetsDescription = energyTargets
		.map((target) => `- ${target.name}: ~${target.percentage}% (~${target.kcalTarget} kcal)`)
		.join('\n')
	const currentDraftDescription = summarizeCurrentDraft(currentMealGroups)
	const clinicalRules = buildClinicalRules(patient).join('\n')
	const aiSettingsPrompt = buildAiSettingsPrompt(settings)
	const strictJsonExample = `{"groups":[${targetMealGroups.map((groupName) => `{"name":"${groupName}","items":[{"food":"...","quantity":"...","measure":"...","notes":""}]}`).join(',')}]}`

	return [
		'Voce e um nutricionista clinico especialista em montar cardapios personalizados.',
		'Objetivo: gerar um cardapio diario mais certeiro para o paciente, em portugues do Brasil.',
		'Responda SOMENTE JSON valido, sem markdown, sem comentarios e sem texto fora do JSON.',
		'Formato de saida obrigatorio (nao altere chaves):',
		strictJsonExample,
		'Regras obrigatorias:',
		`- Gere exatamente ${targetMealGroups.length} grupos.`,
		'- Mantenha a MESMA ORDEM e os MESMOS NOMES dos grupos informados.',
		`- Cada grupo deve ter de 2 a ${aiSettingsPrompt.maxItemsPerGroup} itens (nao retorne grupo vazio).`,
		'- Todos os itens devem conter: food, quantity, measure, notes.',
		'- food deve ser nome curto de alimento, sem frase longa e sem receita completa.',
		'- quantity deve ser valor curto (ex.: "1", "2", "120", "150").',
		'- measure deve ser unidade pratica (ex.: "g", "ml", "unidade", "colher de sopa").',
		'- notes deve ser curto; se nao houver observacao, use string vazia "".',
		'- Nao repetir o mesmo alimento principal em todos os grupos.',
		'- Use alimentos comuns no Brasil e com boa chance de existir na TACO.',
		'- Considere objetivo, atividade, condicoes medicas e TDEE.',
		'Grupos alvo (obrigatorio seguir exatamente):',
		targetMealGroupsDescription,
		'Distribuicao energetica alvo por grupo (aproximada):',
		energyTargetsDescription,
		'Regras clinicas prioritarias:',
		clinicalRules,
		'Parametros definidos pelo nutricionista:',
		...aiSettingsPrompt.promptLines,
		'Rascunho atual do nutricionista (use como preferencia inicial; pode ajustar com justificativa em notes):',
		currentDraftDescription,
		'Dados do paciente:',
		`- Nome: ${patient.name}`,
		`- Sexo: ${formatGender(patient.gender)}`,
		`- Idade: ${age === null ? '-' : `${age} anos`}`,
		`- Peso: ${patient.weight.toFixed(1)} kg`,
		`- Altura: ${patient.height.toFixed(0)} cm`,
		`- IMC: ${patient.bmi.toFixed(1)}`,
		`- Objetivos: ${formatGoalList(patient.goal) || '-'}`,
		`- Atividade: ${formatActivityLevel(patient.activityLevel)}`,
		`- Condicoes medicas: ${patientMedicalConditions}`,
		`- TMB: ${Math.round(patient.bmr)} kcal`,
		`- TDEE: ${Math.round(patient.tdee)} kcal`,
		'Retorne apenas o JSON final.',
	].join('\n')
}

// TRATAMENTO PADRAO DE ERRO HTTP:
// Extrai mensagem do backend quando disponivel e usa fallback quando necessario.
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

// CARD VISUAL REUTILIZAVEL DO RESUMO DO PACIENTE.
function SummaryMetricCard({ label, value }: SummaryMetricCardProps) {
	return (
		<Box className="rounded-xl border border-[#dfebf1] bg-[#f8fcfe] px-3 py-2.5">
			<Text className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
				{label}
			</Text>
			<Text className="mt-1 text-sm font-semibold text-slate-900">
				{value}
			</Text>
		</Box>
	)
}

// COMPONENTE PRINCIPAL DA PAGINA:
// Orquestra carregamento de dados, edicao do cardapio, modal de parametros e geracao via IA.
export function MenuBuilderPage() {
	const { patientId } = useParams<{ patientId: string }>()
	const navigate = useNavigate()
	const location = useLocation()
	const { user, token, logout } = useAuth()

	// ESTADO LOCAL DA TELA:
	// Controla dados carregados, formulario do cardapio, modal e progresso da geracao com IA.
	const [patient, setPatient] = useState<PatientMenuDataResponse | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [isLoadingSavedMenu, setIsLoadingSavedMenu] = useState(false)
	const [isSavingMenuDraft, setIsSavingMenuDraft] = useState(false)
	const [savedMenuUpdatedAt, setSavedMenuUpdatedAt] = useState<string | null>(null)
	const [activeDataEntryStep, setActiveDataEntryStep] = useState(0)
	const [customMealGroupLabel, setCustomMealGroupLabel] = useState('')
	const [mealGroups, setMealGroups] = useState<MealGroupState[]>(() => getInitialMealGroups())
	const [debouncedMealGroups] = useDebouncedValue(mealGroups, 280)
	const [nutritionGuidance, setNutritionGuidance] = useState<NutritionGuidanceState>(() => NUTRITION_GUIDANCE_DEFAULT_STATE)
	const [debouncedNutritionGuidance] = useDebouncedValue(nutritionGuidance, 320)
	const [aiGuidanceHighlights, setAiGuidanceHighlights] = useState<string[]>([])
	const [isGeneratingAiGuidance, setIsGeneratingAiGuidance] = useState(false)
	const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeSuggestionState[]>(() => [createRecipeSuggestion()])
	const [debouncedRecipeSuggestions] = useDebouncedValue(recipeSuggestions, 320)
	const [isGeneratingAiRecipes, setIsGeneratingAiRecipes] = useState(false)
	const [aiRecipeGenerationStep, setAiRecipeGenerationStep] = useState(1)
	const [aiRecipeGenerationStatusMessage, setAiRecipeGenerationStatusMessage] = useState(AI_RECIPE_GENERATION_INITIAL_STATUS)
	const [aiRecipeGenerationStartedAt, setAiRecipeGenerationStartedAt] = useState<number | null>(null)
	const [aiRecipeGenerationElapsedSeconds, setAiRecipeGenerationElapsedSeconds] = useState(0)
	const [aiGuidanceGenerationStep, setAiGuidanceGenerationStep] = useState(1)
	const [aiGuidanceGenerationStatusMessage, setAiGuidanceGenerationStatusMessage] = useState(AI_GUIDANCE_GENERATION_INITIAL_STATUS)
	const [aiGuidanceGenerationStartedAt, setAiGuidanceGenerationStartedAt] = useState<number | null>(null)
	const [aiGuidanceGenerationElapsedSeconds, setAiGuidanceGenerationElapsedSeconds] = useState(0)
	const [tacoFoodOptions, setTacoFoodOptions] = useState<TacoFoodOption[]>([])
	const [tacoFoodEntries, setTacoFoodEntries] = useState<TacoFoodTableEntry[]>([])
	const [isLoadingTacoFoodOptions, setIsLoadingTacoFoodOptions] = useState(true)
	const [isGeneratingAiMenu, setIsGeneratingAiMenu] = useState(false)
	const [aiGenerationStep, setAiGenerationStep] = useState(1)
	const [aiGenerationStatusMessage, setAiGenerationStatusMessage] = useState(AI_GENERATION_INITIAL_STATUS)
	const [aiGenerationStartedAt, setAiGenerationStartedAt] = useState<number | null>(null)
	const [aiGenerationElapsedSeconds, setAiGenerationElapsedSeconds] = useState(0)
	const [isAiSettingsModalOpen, setIsAiSettingsModalOpen] = useState(false)
	const [isAiRecipeSettingsModalOpen, setIsAiRecipeSettingsModalOpen] = useState(false)
	const [aiGenerationSettings, setAiGenerationSettings] = useState<AiGenerationSettingsState>(() => AI_GENERATION_DEFAULT_SETTINGS)
	const [aiRecipeGenerationSettings, setAiRecipeGenerationSettings] = useState<AiRecipeGenerationSettingsState>(() => AI_RECIPE_GENERATION_DEFAULT_SETTINGS)
	const [aiAvailableModels, setAiAvailableModels] = useState<string[]>([])
	const [backendDefaultAiModel, setBackendDefaultAiModel] = useState<string | null>(null)
	const [isLoadingAiModels, setIsLoadingAiModels] = useState(false)
	const [draggingMealGroupId, setDraggingMealGroupId] = useState<string | null>(null)
	const [mealGroupDropTarget, setMealGroupDropTarget] = useState<{
		groupId: string
		placement: MealGroupDropPlacement
	} | null>(null)
	const [currentNutritionist, setCurrentNutritionist] = useState<CurrentNutritionistProfileResponse | null>(null)
	const [nutritionistProfileImageForPdf, setNutritionistProfileImageForPdf] = useState<string | null>(null)
	const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null)
	const [pdfDownloadFileName, setPdfDownloadFileName] = useState('plano-alimentar.pdf')
	const [isGeneratingPdfBlob, setIsGeneratingPdfBlob] = useState(false)
	const [pdfGenerationErrorMessage, setPdfGenerationErrorMessage] = useState<string | null>(null)
	const [hasAppliedLocationPrefill, setHasAppliedLocationPrefill] = useState(false)

	// MEMOIZACAO DE LOOKUPS/ENTRADAS DERIVADAS:
	// Evita recalculos desnecessarios a cada render.
	const tacoFoodLabelById = useMemo(
		() => new Map(tacoFoodOptions.map((option) => [option.value, option.label])),
		[tacoFoodOptions],
	)
	const tacoFoodById = useMemo(
		() => new Map(tacoFoodEntries.map((entry) => [String(entry.id), entry])),
		[tacoFoodEntries],
	)

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

	const locationPrefillMenuDraft = useMemo(() => {
		const navigationState = location.state as MenuBuilderLocationState | null
		const prefillDraft = navigationState?.prefillMenuDraft

		if (!prefillDraft || typeof prefillDraft !== 'object') {
			return null
		}

		return prefillDraft
	}, [location.state])
	const locationPrefillSource = useMemo(() => {
		const navigationState = location.state as MenuBuilderLocationState | null
		return navigationState?.prefillSource ?? null
	}, [location.state])

	const aiModelOptions = useMemo(
		() => aiAvailableModels.map((modelName) => ({ value: modelName, label: modelName })),
		[aiAvailableModels],
	)

	// Quando troca o paciente da rota, reseta o rascunho local antes de carregar os dados remotos.
	useEffect(() => {
		setActiveDataEntryStep(0)
		setCustomMealGroupLabel('')
		setMealGroups(getInitialMealGroups())
		setNutritionGuidance(NUTRITION_GUIDANCE_DEFAULT_STATE)
		setAiGuidanceHighlights([])
		setRecipeSuggestions([createRecipeSuggestion()])
		setAiGenerationSettings(AI_GENERATION_DEFAULT_SETTINGS)
		setAiRecipeGenerationSettings(AI_RECIPE_GENERATION_DEFAULT_SETTINGS)
		setSavedMenuUpdatedAt(null)
		setHasAppliedLocationPrefill(false)
	}, [parsedPatientId])

	// EFEITO 1:
	// Carrega dados do paciente ao entrar na pagina ou quando o id/token mudam.
	useEffect(() => {
		const controller = new AbortController()

		const loadPatient = async () => {
			if (!token) {
				logout()
				return
			}

			if (parsedPatientId === null) {
				setPatient(null)
				setErrorMessage('Identificador de paciente invalido.')
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
					throw new Error('Paciente nao encontrado.')
				}

				if (!response.ok) {
					const message = await extractErrorMessage(response, LOAD_PATIENT_ERROR_MESSAGE)
					throw new Error(message)
				}

				const data = (await response.json()) as PatientMenuDataResponse
				if (!controller.signal.aborted) {
					setPatient(data)
				}
			} catch (error) {
				if (controller.signal.aborted) {
					return
				}

				const message = error instanceof Error ? error.message : LOAD_PATIENT_ERROR_MESSAGE
				setPatient(null)
				setErrorMessage(message)
			} finally {
				if (!controller.signal.aborted) {
					setIsLoading(false)
				}
			}
		}

		void loadPatient()

		return () => {
			controller.abort()
		}
	}, [logout, parsedPatientId, token])

	useEffect(() => {
		if (!token || parsedPatientId === null || patient?.id !== parsedPatientId) {
			return
		}

		const controller = new AbortController()

		const loadSavedMenuDraft = async () => {
			try {
				setIsLoadingSavedMenu(true)
				const applyDraftToState = (
					data: PatientMenuDraftApiResponse,
					shouldStartFromFirstStep = false,
				) => {
					const resolvedStep = shouldStartFromFirstStep
						? 0
						: Math.min(Math.max(data.activeDataEntryStep, 0), DATA_ENTRY_STEPS_TOTAL - 1)
					setActiveDataEntryStep(resolvedStep)
					setMealGroups(normalizeMealGroupsFromApi(data.mealGroups))
					setNutritionGuidance(normalizeNutritionGuidanceFromApi(data.nutritionGuidance))
					setAiGuidanceHighlights(normalizeAiGuidanceHighlightsFromApi(data.aiGuidanceHighlights))
					setRecipeSuggestions(normalizeRecipeSuggestionsFromApi(data.recipeSuggestions))
					setAiGenerationSettings(normalizeAiGenerationSettingsFromApi(data.aiGenerationSettings))
					setAiRecipeGenerationSettings(normalizeAiRecipeGenerationSettingsFromApi(data.aiRecipeGenerationSettings))
					setSavedMenuUpdatedAt(typeof data.updatedAt === 'string' ? data.updatedAt : null)
				}

				if (locationPrefillSource === 'new-empty') {
					if (!controller.signal.aborted) {
						setSavedMenuUpdatedAt(null)
						setHasAppliedLocationPrefill(true)
					}
					return
				}

				if (
					locationPrefillMenuDraft &&
					!hasAppliedLocationPrefill &&
					locationPrefillMenuDraft.patientId === parsedPatientId
				) {
					if (!controller.signal.aborted) {
						const shouldStartFromFirstStep = locationPrefillSource === 'saved-history'
						applyDraftToState(locationPrefillMenuDraft, shouldStartFromFirstStep)
						setHasAppliedLocationPrefill(true)
					}
					return
				}

				const response = await fetch(buildApiUrl(`/api/patients/${parsedPatientId}/menu`), {
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
					if (!controller.signal.aborted) {
						setSavedMenuUpdatedAt(null)
					}
					return
				}

				if (!response.ok) {
					const message = await extractErrorMessage(response, LOAD_SAVED_MENU_ERROR_MESSAGE)
					throw new Error(message)
				}

				const data = (await response.json()) as PatientMenuDraftApiResponse
				if (controller.signal.aborted) {
					return
				}

				applyDraftToState(data)
			} catch (error) {
				if (controller.signal.aborted) {
					return
				}

				const message = error instanceof Error ? error.message : LOAD_SAVED_MENU_ERROR_MESSAGE
				showErrorNotification('Erro ao carregar cardapio salvo', message)
			} finally {
				if (!controller.signal.aborted) {
					setIsLoadingSavedMenu(false)
				}
			}
		}

		void loadSavedMenuDraft()

		return () => {
			controller.abort()
		}
	}, [
		hasAppliedLocationPrefill,
		locationPrefillMenuDraft,
		locationPrefillSource,
		logout,
		parsedPatientId,
		patient?.id,
		token,
	])

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
					throw new Error('Nao foi possivel carregar a foto do nutricionista.')
				}

				const imageBlob = await response.blob()
				const imageDataUrl = await convertBlobToDataUrl(imageBlob)
				if (!controller.signal.aborted) {
					setNutritionistProfileImageForPdf(imageDataUrl)
				}
			} catch {
				if (!controller.signal.aborted) {
					// Mantem URL original como fallback caso a conversao para data URL falhe.
					setNutritionistProfileImageForPdf(normalizedProfileImage)
				}
			}
		}

		void resolveProfileImage()

		return () => {
			controller.abort()
		}
	}, [currentNutritionist?.profilePicture, token])

	// EFEITO 2:
	// Carrega a tabela TACO (JSON local) para popular o select de alimentos.
	useEffect(() => {
		let isMounted = true

			const loadTacoFoodOptions = async () => {
				try {
					const tacoModule = await import('../../../dates/tables/TACO.json')
					if (!isMounted) {
						return
					}

					const parsedTacoFoodEntries = parseTacoFoodEntries(tacoModule.default)
					setTacoFoodEntries(parsedTacoFoodEntries)
					setTacoFoodOptions(buildTacoFoodOptions(parsedTacoFoodEntries))
				} catch {
					if (!isMounted) {
						return
					}

					setTacoFoodEntries([])
					setTacoFoodOptions([])
				} finally {
					if (isMounted) {
						setIsLoadingTacoFoodOptions(false)
				}
			}
		}

		void loadTacoFoodOptions()

		return () => {
			isMounted = false
		}
	}, [])

	// EFEITO 3:
	// Busca modelos disponiveis no backend quando o modal de parametros da IA e aberto.
	useEffect(() => {
		if ((!isAiSettingsModalOpen && !isAiRecipeSettingsModalOpen) || !token) {
			return
		}

		let isActive = true

		const loadAiModels = async () => {
			try {
				setIsLoadingAiModels(true)

				const response = await fetch(buildApiUrl('/api/ai/models'), {
					method: 'GET',
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: 'application/json',
					},
				})

				if (response.status === 401) {
					logout()
					return
				}

				if (!response.ok) {
					if (isActive) {
						setAiAvailableModels([])
					}
					return
				}

				const data = (await response.json()) as AiModelsApiResponse
				if (!isActive) {
					return
				}

				const availableModels = Array.isArray(data.availableModels)
					? data.availableModels.filter((modelName) => typeof modelName === 'string' && modelName.trim().length > 0)
					: []

				setAiAvailableModels(availableModels)
				setBackendDefaultAiModel(typeof data.model === 'string' && data.model.trim().length > 0 ? data.model : null)
			} catch {
				if (!isActive) {
					return
				}

				setAiAvailableModels([])
			} finally {
				if (isActive) {
					setIsLoadingAiModels(false)
				}
			}
		}

		void loadAiModels()

		return () => {
			isActive = false
		}
	}, [isAiRecipeSettingsModalOpen, isAiSettingsModalOpen, logout, token])

	// EFEITO 4:
	// Atualiza contador de tempo exibido no overlay durante a geracao.
	useEffect(() => {
		if (!isGeneratingAiMenu || aiGenerationStartedAt === null) {
			return
		}

		const intervalId = window.setInterval(() => {
			setAiGenerationElapsedSeconds(Math.floor((Date.now() - aiGenerationStartedAt) / 1000))
		}, 1000)

		return () => {
			window.clearInterval(intervalId)
		}
	}, [aiGenerationStartedAt, isGeneratingAiMenu])

	useEffect(() => {
		if (!isGeneratingAiGuidance || aiGuidanceGenerationStartedAt === null) {
			return
		}

		const intervalId = window.setInterval(() => {
			setAiGuidanceGenerationElapsedSeconds(Math.floor((Date.now() - aiGuidanceGenerationStartedAt) / 1000))
		}, 1000)

		return () => {
			window.clearInterval(intervalId)
		}
	}, [aiGuidanceGenerationStartedAt, isGeneratingAiGuidance])

	useEffect(() => {
		if (!isGeneratingAiRecipes || aiRecipeGenerationStartedAt === null) {
			return
		}

		const intervalId = window.setInterval(() => {
			setAiRecipeGenerationElapsedSeconds(Math.floor((Date.now() - aiRecipeGenerationStartedAt) / 1000))
		}, 1000)

		return () => {
			window.clearInterval(intervalId)
		}
	}, [aiRecipeGenerationStartedAt, isGeneratingAiRecipes])

	// DADOS DERIVADOS PARA EXIBICAO:
	// Consolidam informacoes clinicas e de UI sem duplicar logica no JSX.
	const patientAge = useMemo(() => {
		if (!patient) {
			return null
		}

		return calculateAgeFromIsoDate(patient.birthDate)
	}, [patient])

	const patientGoals = useMemo(() => {
		if (!patient) {
			return '-'
		}

		return formatGoalList(patient.goal) || '-'
	}, [patient])

	const patientMedicalConditions = useMemo(() => {
		if (!patient) {
			return '-'
		}

		const formattedConditions = patient.medicalConditions
			.map((condition) => formatMedicalCondition(condition))
			.filter((condition) => condition.length > 0)

		return formattedConditions.length > 0 ? formattedConditions.join(', ') : 'Nenhuma informada'
	}, [patient])
	const totalCurrentMealItems = useMemo(
		() => mealGroups.reduce((total, group) => total + group.items.length, 0),
		[mealGroups],
	)
	const nutritionGuidanceTipsForPdf = useMemo(() => {
		if (!patient) {
			return []
		}

		return buildNutritionGuidanceTips(patient, debouncedNutritionGuidance, aiGuidanceHighlights)
	}, [aiGuidanceHighlights, debouncedNutritionGuidance, patient])
	const filledNutritionGuidanceFieldsCount = useMemo(() => {
		let filledCount = 0

		if (nutritionGuidance.hydrationGoalMl !== null) {
			filledCount += 1
		}

		const textFields: NutritionGuidanceTextField[] = [
			'mealRoutineGuidance',
			'foodQualityGuidance',
			'preparationGuidance',
			'behaviorGuidance',
			'symptomMonitoringGuidance',
			'restrictionsGuidance',
			'additionalGuidance',
		]

		for (const field of textFields) {
			if (normalizeTextField(nutritionGuidance[field]).length > 0) {
				filledCount += 1
			}
		}

		return filledCount
	}, [nutritionGuidance])
	const selectedFoodsForRecipes = useMemo(
		() => extractSelectedFoodsFromMealGroups(mealGroups),
		[mealGroups],
	)
	const filledRecipeSuggestionsCount = useMemo(() => (
		recipeSuggestions.reduce((total, recipe) => (
			normalizeTextField(recipe.recipeName).length > 0 ||
			normalizeTextField(recipe.ingredients).length > 0 ||
			normalizeTextField(recipe.preparationMethod).length > 0
				? total + 1
				: total
		), 0)
	), [recipeSuggestions])
	const planNutritionPreview = useMemo(
		() => buildPlanNutritionPreviewData(mealGroups, tacoFoodById, patient?.gender ?? ''),
		[mealGroups, patient?.gender, tacoFoodById],
	)
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
	const effectiveAiMenuModelLabel = aiGenerationSettings.modelOverride?.trim() || backendDefaultAiModel || 'Padrao do backend'
	const effectiveAiGuidanceModelLabel = aiGenerationSettings.modelOverride?.trim() || backendDefaultAiModel || 'Padrao do backend'
	const effectiveAiRecipeModelLabel = aiRecipeGenerationSettings.modelOverride?.trim()
		|| aiGenerationSettings.modelOverride?.trim()
		|| backendDefaultAiModel
		|| 'Padrao do backend'
	const handlePdfBlobStateChange = useCallback((nextBlobState: MealPlanPdfBlobState) => {
		setPdfDownloadUrl(nextBlobState.url)
		setPdfDownloadFileName(nextBlobState.downloadFileName)
		setIsGeneratingPdfBlob(nextBlobState.isGeneratingBlob)
		setPdfGenerationErrorMessage(nextBlobState.generationErrorMessage)
	}, [])

	// CONFIGURACOES DE APRESENTACAO DA PAGINA E DO MODAL.
	const pageTitle = patient ? `Cardapio: ${patient.name}` : 'Cardapio do paciente'
	const modalActionButtonSizeClassName = 'w-[156px]'
	const modalClassNames = {
		content:
			'overflow-hidden rounded-2xl border border-[#c8e4ef] bg-white shadow-[0_20px_48px_rgba(15,23,42,0.24)]',
		header:
			'border-b border-[#d3e4eb] bg-[linear-gradient(125deg,rgba(39,144,176,0.10)_0%,rgba(148,186,101,0.10)_62%,rgba(255,255,255,0.98)_100%)] px-5 py-3',
		title: 'text-sm font-semibold tracking-[0.01em] text-slate-900',
		body: 'p-0',
		close:
			'text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800',
	}

	// CONTROLE DE ABERTURA/FECHAMENTO DO MODAL DE PARAMETROS.
	const closeAiSettingsModal = () => {
		if (isGeneratingAiMenu) {
			return
		}

		setIsAiSettingsModalOpen(false)
	}

	const closeAiRecipeSettingsModal = () => {
		if (isGeneratingAiRecipes) {
			return
		}

		setIsAiRecipeSettingsModalOpen(false)
	}

	const openAiSettingsModal = () => {
		if (!patient) {
			showErrorNotification('Geracao com IA', 'Dados do paciente indisponiveis para gerar cardapio.')
			return
		}

		setIsAiSettingsModalOpen(true)
	}

	const openAiRecipeSettingsModal = () => {
		if (!patient) {
			showErrorNotification('Receitas sugeridas', 'Dados do paciente indisponiveis para gerar receitas.')
			return
		}

		if (selectedFoodsForRecipes.length === 0) {
			showWarningNotification('Receitas sugeridas', 'Selecione alimentos no plano alimentar antes de gerar receitas.')
			return
		}

		setIsAiRecipeSettingsModalOpen(true)
	}

	const handleDataEntryStepChange = (nextStep: number) => {
		setActiveDataEntryStep(Math.min(Math.max(nextStep, 0), DATA_ENTRY_STEPS_TOTAL - 1))
	}

	const handleSaveMenuDraftClick = async () => {
		if (!token) {
			logout()
			return
		}

		if (parsedPatientId === null || !patient) {
			showErrorNotification('Salvar cardapio', 'Paciente invalido para salvar o cardapio.')
			return
		}

		const payload: SavePatientMenuDraftRequest = {
			activeDataEntryStep,
			mealGroups,
			nutritionGuidance,
			aiGuidanceHighlights,
			recipeSuggestions,
			aiGenerationSettings,
			aiRecipeGenerationSettings,
		}

		try {
			setIsSavingMenuDraft(true)

			const response = await fetch(buildApiUrl(`/api/patients/${parsedPatientId}/menu`), {
				method: 'PUT',
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			})

			if (response.status === 401) {
				logout()
				return
			}

			if (!response.ok) {
				const message = await extractErrorMessage(response, SAVE_MENU_ERROR_MESSAGE)
				throw new Error(message)
			}

			const data = (await response.json()) as PatientMenuDraftApiResponse
			setActiveDataEntryStep(Math.min(Math.max(data.activeDataEntryStep, 0), DATA_ENTRY_STEPS_TOTAL - 1))
			setMealGroups(normalizeMealGroupsFromApi(data.mealGroups))
			setNutritionGuidance(normalizeNutritionGuidanceFromApi(data.nutritionGuidance))
			setAiGuidanceHighlights(normalizeAiGuidanceHighlightsFromApi(data.aiGuidanceHighlights))
			setRecipeSuggestions(normalizeRecipeSuggestionsFromApi(data.recipeSuggestions))
			setAiGenerationSettings(normalizeAiGenerationSettingsFromApi(data.aiGenerationSettings))
			setAiRecipeGenerationSettings(normalizeAiRecipeGenerationSettingsFromApi(data.aiRecipeGenerationSettings))
			setSavedMenuUpdatedAt(typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString())

			showSuccessNotification('Cardapio salvo', 'Rascunho completo salvo com sucesso.')
		} catch (error) {
			const message = error instanceof Error ? error.message : SAVE_MENU_ERROR_MESSAGE
			showErrorNotification('Erro ao salvar cardapio', message)
		} finally {
			setIsSavingMenuDraft(false)
		}
	}

	const handleNutritionGuidanceTextFieldChange = (
		field: NutritionGuidanceTextField,
		nextValue: string,
	) => {
		setNutritionGuidance((previousGuidance) => ({
			...previousGuidance,
			[field]: nextValue,
		}))
	}

	const handleNutritionGuidanceHydrationGoalChange = (value: string | number) => {
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			setNutritionGuidance((previousGuidance) => ({
				...previousGuidance,
				hydrationGoalMl: null,
			}))
			return
		}

		const boundedValue = Math.min(Math.max(Math.round(value), 1200), 7000)
		setNutritionGuidance((previousGuidance) => ({
			...previousGuidance,
			hydrationGoalMl: boundedValue,
		}))
	}

	const handleGenerateAiGuidanceClick = async () => {
		if (!token) {
			logout()
			return
		}

		if (!patient) {
			showErrorNotification('Orientacoes nutricionais', 'Dados do paciente indisponiveis para gerar orientacoes.')
			return
		}

		try {
			setIsGeneratingAiGuidance(true)
			const modelOverride = aiGenerationSettings.modelOverride?.trim()
			const targetModelLabel = modelOverride || backendDefaultAiModel || 'padrao do backend'
			setAiGuidanceGenerationStep(1)
			setAiGuidanceGenerationStatusMessage(AI_GUIDANCE_GENERATION_INITIAL_STATUS)
			setAiGuidanceGenerationStartedAt(Date.now())
			setAiGuidanceGenerationElapsedSeconds(0)
			setAiGuidanceGenerationStep(2)
			setAiGuidanceGenerationStatusMessage(`Enviando prompt de orientacoes para o modelo ${targetModelLabel}...`)
			const response = await fetch(buildApiUrl('/api/ai/chat'), {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					prompt: buildGuidanceGenerationPrompt(patient, mealGroups, nutritionGuidance),
					model: modelOverride ? modelOverride : undefined,
				}),
			})

			if (response.status === 401) {
				logout()
				return
			}

			if (!response.ok) {
				const message = await extractErrorMessage(response, GENERATE_GUIDANCE_ERROR_MESSAGE)
				throw new Error(message)
			}

			setAiGuidanceGenerationStep(3)
			setAiGuidanceGenerationStatusMessage('Interpretando resposta e estruturando orientacoes...')
			const aiResponse = (await response.json()) as Partial<AiChatResponse>
			const aiContent = typeof aiResponse.content === 'string' ? aiResponse.content : ''
			const parsedGuidance = parseAiGeneratedNutritionGuidance(aiContent)
			if (!parsedGuidance) {
				throw new Error('A IA retornou orientacoes em formato invalido. Tente novamente.')
			}

			setAiGuidanceGenerationStep(4)
			setAiGuidanceGenerationStatusMessage('Aplicando orientacoes no formulario e no preview...')
			setNutritionGuidance((previousGuidance) => ({
				...previousGuidance,
				...parsedGuidance.guidance,
			}))

			if (parsedGuidance.highlights.length > 0) {
				setAiGuidanceHighlights(parsedGuidance.highlights)
			}

			showSuccessNotification(
				'Orientacoes geradas',
				`Orientacoes detalhadas atualizadas (${parsedGuidance.highlights.length} destaque(s) principais).`,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : GENERATE_GUIDANCE_ERROR_MESSAGE
			showErrorNotification('Erro ao gerar orientacoes', message)
		} finally {
			setIsGeneratingAiGuidance(false)
			setAiGuidanceGenerationStep(1)
			setAiGuidanceGenerationStatusMessage(AI_GUIDANCE_GENERATION_INITIAL_STATUS)
			setAiGuidanceGenerationStartedAt(null)
			setAiGuidanceGenerationElapsedSeconds(0)
		}
	}

	const handleAddRecipeSuggestion = () => {
		setRecipeSuggestions((previousRecipes) => [...previousRecipes, createRecipeSuggestion()])
	}

	const handleRemoveRecipeSuggestion = (recipeId: string) => {
		setRecipeSuggestions((previousRecipes) => {
			if (previousRecipes.length <= 1) {
				return [createRecipeSuggestion()]
			}

			return previousRecipes.filter((recipe) => recipe.id !== recipeId)
		})
	}

	const handleRecipeSuggestionFieldChange = (
		recipeId: string,
		field: RecipeSuggestionEditableField,
		nextValue: string,
	) => {
		setRecipeSuggestions((previousRecipes) => (
			previousRecipes.map((recipe) => (
				recipe.id === recipeId
					? {
						...recipe,
						[field]: nextValue,
					}
					: recipe
			))
		))
	}

	const handleGenerateAiRecipeSuggestionsClick = async () => {
		if (!token) {
			logout()
			return
		}

		if (!patient) {
			showErrorNotification('Receitas sugeridas', 'Dados do paciente indisponiveis para gerar receitas.')
			return
		}

		if (selectedFoodsForRecipes.length === 0) {
			showWarningNotification('Receitas sugeridas', 'Selecione alimentos no plano alimentar antes de gerar receitas.')
			return
		}

		try {
			const resolvedRecipeSettings = buildAiRecipeSettingsPrompt(aiRecipeGenerationSettings)
			setIsGeneratingAiRecipes(true)
			setIsAiRecipeSettingsModalOpen(false)
			const modelOverride = aiRecipeGenerationSettings.modelOverride?.trim() || aiGenerationSettings.modelOverride?.trim()
			const targetModelLabel = modelOverride || backendDefaultAiModel || 'padrao do backend'
			setAiRecipeGenerationStep(1)
			setAiRecipeGenerationStatusMessage(AI_RECIPE_GENERATION_INITIAL_STATUS)
			setAiRecipeGenerationStartedAt(Date.now())
			setAiRecipeGenerationElapsedSeconds(0)
			setAiRecipeGenerationStep(2)
			setAiRecipeGenerationStatusMessage(`Enviando prompt de receitas para o modelo ${targetModelLabel}...`)
			const response = await fetch(buildApiUrl('/api/ai/chat'), {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					prompt: buildRecipeSuggestionsGenerationPrompt(
						patient,
						mealGroups,
						nutritionGuidance,
						recipeSuggestions,
						aiRecipeGenerationSettings,
					),
					model: modelOverride ? modelOverride : undefined,
				}),
			})

			if (response.status === 401) {
				logout()
				return
			}

			if (!response.ok) {
				const message = await extractErrorMessage(response, GENERATE_RECIPE_SUGGESTIONS_ERROR_MESSAGE)
				throw new Error(message)
			}

			setAiRecipeGenerationStep(3)
			setAiRecipeGenerationStatusMessage('Interpretando retorno e estruturando tabela de receitas...')
			const aiResponse = (await response.json()) as Partial<AiChatResponse>
			const aiContent = typeof aiResponse.content === 'string' ? aiResponse.content : ''
			const parsedRecipes = parseAiGeneratedRecipeSuggestions(aiContent)
			if (parsedRecipes.length === 0) {
				throw new Error('A IA retornou receitas em formato invalido. Tente novamente.')
			}
			const recipesToApply = parsedRecipes.slice(0, resolvedRecipeSettings.recipeCount)

			setAiRecipeGenerationStep(4)
			setAiRecipeGenerationStatusMessage('Aplicando receitas sugeridas...')
			setRecipeSuggestions(recipesToApply)

			showSuccessNotification(
				'Receitas geradas',
				recipesToApply.length < resolvedRecipeSettings.recipeCount
					? `Foram aplicadas ${recipesToApply.length} receita(s). O alvo configurado era ${resolvedRecipeSettings.recipeCount}.`
					: `${recipesToApply.length} receita(s) sugerida(s) com base nos alimentos selecionados.`,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : GENERATE_RECIPE_SUGGESTIONS_ERROR_MESSAGE
			showErrorNotification('Erro ao gerar receitas', message)
		} finally {
			setIsGeneratingAiRecipes(false)
			setAiRecipeGenerationStep(1)
			setAiRecipeGenerationStatusMessage(AI_RECIPE_GENERATION_INITIAL_STATUS)
			setAiRecipeGenerationStartedAt(null)
			setAiRecipeGenerationElapsedSeconds(0)
		}
	}

	// HANDLERS DE EDICAO DO CARDAPIO (CRUD):
	// Adiciona/remove grupos e itens, e atualiza campos de cada alimento.
	const handleAddMealGroup = () => {
		const normalizedLabel = customMealGroupLabel.trim()
		const nextLabel = normalizedLabel || `Refeicao ${mealGroups.length + 1}`
		setMealGroups((previousGroups) => [...previousGroups, createMealGroup(nextLabel)])
		setCustomMealGroupLabel('')
	}

	const handleRemoveMealGroup = (groupId: string) => {
		setMealGroups((previousGroups) => previousGroups.filter((group) => group.id !== groupId))
	}

	const handleMealGroupNameChange = (groupId: string, nextValue: string) => {
		setMealGroups((previousGroups) =>
			previousGroups.map((group) => (
				group.id === groupId
					? {
						...group,
						name: nextValue,
					}
					: group
			)),
		)
	}

	const handleAddMealItem = (groupId: string) => {
		setMealGroups((previousGroups) =>
			previousGroups.map((group) => (
				group.id === groupId
					? {
						...group,
						items: [...group.items, createMealItem()],
					}
					: group
			)),
		)
	}

	const handleRemoveMealItem = (groupId: string, itemId: string) => {
		setMealGroups((previousGroups) =>
			previousGroups.map((group) => {
				if (group.id !== groupId) {
					return group
				}

				if (group.items.length <= 1) {
					return group
				}

				return {
					...group,
					items: group.items.filter((item) => item.id !== itemId),
				}
			}),
		)
	}

	const handleMealItemFieldChange = (
		groupId: string,
		itemId: string,
		field: MealItemEditableField,
		nextValue: string,
	) => {
		setMealGroups((previousGroups) =>
			previousGroups.map((group) => (
				group.id === groupId
					? {
						...group,
						items: group.items.map((item) => (
							item.id === itemId
								? {
									...item,
									[field]: nextValue,
								}
								: item
						)),
					}
					: group
			)),
		)
	}

	const handleMealItemFoodChange = (groupId: string, itemId: string, nextFoodId: string | null) => {
		setMealGroups((previousGroups) =>
			previousGroups.map((group) => {
				if (group.id !== groupId) {
					return group
				}

				return {
					...group,
					items: group.items.map((item) => {
						if (item.id !== itemId) {
							return item
						}

						if (!nextFoodId) {
							return {
								...item,
								foodId: null,
								food: '',
							}
						}

						return {
							...item,
							foodId: nextFoodId,
							food: tacoFoodLabelById.get(nextFoodId) ?? '',
						}
					}),
				}
			}),
			)
	}

	// HANDLERS DE REORDENACAO:
	// Permitem arrastar e reposicionar grupos de refeicao no formulario.
	const handleMealGroupDragStart = (event: DragEvent<HTMLButtonElement>, groupId: string) => {
		event.dataTransfer.effectAllowed = 'move'
		event.dataTransfer.setData('text/plain', groupId)
		setDraggingMealGroupId(groupId)
		setMealGroupDropTarget(null)
	}

	const handleMealGroupDragOver = (event: DragEvent<HTMLDivElement>, targetGroupId: string) => {
		event.preventDefault()
		event.dataTransfer.dropEffect = 'move'

		const sourceGroupId = draggingMealGroupId ?? event.dataTransfer.getData('text/plain')
		if (!sourceGroupId || sourceGroupId === targetGroupId) {
			setMealGroupDropTarget(null)
			return
		}

		const targetBounds = event.currentTarget.getBoundingClientRect()
		const relativeY = event.clientY - targetBounds.top
		const placement: MealGroupDropPlacement = relativeY <= targetBounds.height / 2 ? 'before' : 'after'

		setMealGroupDropTarget((previousTarget) => {
			if (previousTarget?.groupId === targetGroupId && previousTarget.placement === placement) {
				return previousTarget
			}

			return {
				groupId: targetGroupId,
				placement,
			}
		})
	}

	const handleMealGroupDrop = (event: DragEvent<HTMLDivElement>, targetGroupId: string) => {
		event.preventDefault()

		const sourceGroupId = draggingMealGroupId ?? event.dataTransfer.getData('text/plain')
		if (!sourceGroupId || sourceGroupId === targetGroupId) {
			setDraggingMealGroupId(null)
			setMealGroupDropTarget(null)
			return
		}

		const placement = mealGroupDropTarget?.groupId === targetGroupId
			? mealGroupDropTarget.placement
			: 'after'

		setMealGroups((previousGroups) =>
			reorderMealGroups(previousGroups, sourceGroupId, targetGroupId, placement),
		)
		setDraggingMealGroupId(null)
		setMealGroupDropTarget(null)
	}

	const handleMealGroupDragEnd = () => {
		setDraggingMealGroupId(null)
		setMealGroupDropTarget(null)
	}

	// INTEGRACAO COM IA:
	// Monta prompt, envia para backend, interpreta retorno e aplica no estado da tela.
	const handleAiGenerateClick = async () => {
		if (!token) {
			logout()
			return
		}

		if (!patient) {
			showErrorNotification('Geracao com IA', 'Dados do paciente indisponiveis para gerar cardapio.')
			return
		}

		try {
			setIsGeneratingAiMenu(true)
			setIsAiSettingsModalOpen(false)
			setAiGenerationStep(1)
			setAiGenerationStatusMessage(AI_GENERATION_INITIAL_STATUS)
			setAiGenerationStartedAt(Date.now())
			setAiGenerationElapsedSeconds(0)
			const modelOverride = aiGenerationSettings.modelOverride?.trim()
			const targetModelLabel = modelOverride || backendDefaultAiModel || 'padrao do backend'
			setAiGenerationStep(2)
			setAiGenerationStatusMessage(`Enviando prompt para o modelo ${targetModelLabel}...`)

			const response = await fetch(buildApiUrl('/api/ai/chat'), {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					prompt: buildMenuGenerationPrompt(patient, mealGroups, aiGenerationSettings),
					model: modelOverride ? modelOverride : undefined,
				}),
			})

			if (response.status === 401) {
				logout()
				return
			}

			if (!response.ok) {
				const message = await extractErrorMessage(response, GENERATE_MENU_ERROR_MESSAGE)
				throw new Error(message)
			}

			setAiGenerationStep(3)
			setAiGenerationStatusMessage('Interpretando resposta do modelo...')
			const aiResponse = (await response.json()) as Partial<AiChatResponse>
			const aiContent = typeof aiResponse.content === 'string' ? aiResponse.content : ''
			const aiGroups = parseAiGeneratedMealGroups(aiContent)
			if (aiGroups.length === 0) {
				throw new Error('A IA retornou um formato invalido. Tente novamente.')
			}

			setAiGenerationStep(4)
			setAiGenerationStatusMessage('Mapeando alimentos sugeridos com a tabela TACO...')
			const { mealGroups: mappedMealGroups, unmatchedFoods } = mapAiGroupsToMealGroups(aiGroups, tacoFoodOptions)
			setAiGenerationStep(5)
			setAiGenerationStatusMessage('Aplicando sugestoes e finalizando...')
			setMealGroups(mappedMealGroups)

			if (unmatchedFoods.length > 0) {
				showWarningNotification(
					'Cardapio gerado com IA',
					`${unmatchedFoods.length} alimento(s) nao foi(ram) mapeado(s) automaticamente na TACO. Revise os itens com observacao.`,
				)
			} else {
				showSuccessNotification('Cardapio gerado com IA', 'Cardapio aplicado com sucesso.')
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : GENERATE_MENU_ERROR_MESSAGE
			showErrorNotification('Erro na geracao com IA', message)
		} finally {
			setIsGeneratingAiMenu(false)
			setAiGenerationStep(1)
			setAiGenerationStatusMessage(AI_GENERATION_INITIAL_STATUS)
			setAiGenerationStartedAt(null)
			setAiGenerationElapsedSeconds(0)
		}
	}

	// A confirmacao do modal delega para o fluxo principal de geracao.
	const handleConfirmAiGenerate = () => {
		if (isGeneratingAiMenu) {
			return
		}

		void handleAiGenerateClick()
	}

	const handleConfirmAiRecipeGenerate = () => {
		if (isGeneratingAiRecipes) {
			return
		}

		void handleGenerateAiRecipeSuggestionsClick()
	}

	// RENDER:
	// 1) Layout principal da pagina.
	// 2) Conteudo com estados de loading/erro/sucesso.
	// 3) Modal de parametros da IA.
	// 4) Overlay global enquanto a IA gera sugestoes.
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
								{pageTitle}
							</Text>
						)}
					/>
				</Box>

				<Box className="min-h-0 flex-1 p-3 md:p-6">
					<PageContentContainer className="bg-[hsl(var(--card))]" contentClassName="relative h-full min-h-0 overflow-hidden p-3 md:p-4">
						{/* ESTADOS DE CONTEUDO DA PAGINA: loading, erro, dados carregados ou fallback. */}
						{isLoading ? (
							<Stack gap="md">
								<Box className="rounded-2xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-5">
									<Skeleton height={22} width="38%" radius="sm" />
									<Skeleton height={14} mt={12} width="52%" radius="sm" />
								</Box>
								<Box className="rounded-2xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-5">
									<Grid gutter="md">
										{Array.from({ length: 8 }).map((_, index) => (
											<Grid.Col key={`menu-builder-skeleton-${index}`} span={{ base: 12, md: 6, lg: 3 }}>
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
								<Group className="mt-3">
									<Button
										type="button"
										radius="md"
										classNames={neutralButtonClassNames}
										onClick={() => navigate('/patients')}
									>
										Voltar para pacientes
									</Button>
								</Group>
							</Box>
						) : patient ? (
							<Box className="h-full min-h-0 rounded-[22px] border border-[#d0e0e8] bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fb_100%)] p-3 md:p-4">
									<Grid
										columns={12}
										gutter="md"
										align="stretch"
										styles={{ inner: { height: '100%' } }}
										className="h-full min-h-0"
									>
										{/* COLUNA ESQUERDA: resumo clinico e construcao do cardapio. */}
										<Grid.Col span={{ base: 12, md: 7 }} className="h-full min-h-0">
										<Box className="h-full min-h-0 rounded-[18px] border border-[#d5e4eb] bg-white/80 p-3 md:p-4">
											<Stack gap="md" className="patients-table-scroll h-full min-h-0 overflow-y-auto pr-1 pb-1">
												<Box className="rounded-[26px] border border-[#c8e4ef] bg-[linear-gradient(125deg,rgba(39,144,176,0.12)_0%,rgba(148,186,101,0.13)_52%,rgba(255,255,255,0.98)_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:p-5">
													<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
														Montagem do cardapio
													</Text>
													<Text className="mt-1 text-lg font-semibold text-slate-900 md:text-xl">
														Planejamento alimentar de {patient.name}
													</Text>
													<Text className="mt-2 text-sm text-slate-600">
														Adicione grupos de refeicao e monte cada item manualmente. A integracao de IA e
														a geracao de PDF ficam nesta tela e serao conectadas no proximo passo.
													</Text>
												</Box>

												<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4">
													<Stepper
														active={activeDataEntryStep}
														onStepClick={handleDataEntryStepChange}
														allowNextStepsSelect={true}
														color="cyan"
														size="sm"
														classNames={{
															stepLabel: 'text-xs font-semibold text-slate-700',
															stepDescription: 'text-[0.72rem] text-slate-500',
														}}
													>
														<Stepper.Step label="Etapa 1" description="Itens do plano alimentar" />
														<Stepper.Step label="Etapa 2" description="Orientacoes do nutricionista" />
														<Stepper.Step label="Etapa 3" description="Receitas sugeridas" />
													</Stepper>
												</Box>

												<Box className={activeDataEntryStep === 0 ? 'space-y-4' : 'hidden'}>
												<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4">
													<Text className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
														Resumo do paciente
													</Text>
													<Grid gutter="sm" mt="xs">
														<Grid.Col span={{ base: 12, lg: 4 }}>
															<SummaryMetricCard label="Nome" value={patient.name} />
														</Grid.Col>
														<Grid.Col span={{ base: 12, lg: 4 }}>
															<SummaryMetricCard label="ID do paciente" value={`#${patient.id}`} />
														</Grid.Col>
														<Grid.Col span={{ base: 12, lg: 4 }}>
															<SummaryMetricCard
																label="Data de nascimento"
																value={formatDate(patient.birthDate)}
															/>
														</Grid.Col>
													</Grid>

													<Spoiler
														maxHeight={0}
														showLabel="Ver todos os cards do paciente"
														hideLabel="Ocultar cards do paciente"
														classNames={{
															control: 'mt-3 text-xs font-semibold text-cyan-700 hover:text-cyan-800',
														}}
													>
														<Grid gutter="sm" mt="sm">
															<Grid.Col span={{ base: 6, lg: 4 }}>
																<SummaryMetricCard
																	label="Data de cadastro"
																	value={formatDate(patient.createdAt)}
																/>
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 4 }}>
																<SummaryMetricCard
																	label="Idade"
																	value={patientAge === null ? '-' : `${patientAge} anos`}
																/>
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 4 }}>
																<SummaryMetricCard label="Sexo" value={formatGender(patient.gender)} />
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 4 }}>
																<SummaryMetricCard label="Peso" value={formatMetric(patient.weight, 'kg')} />
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 4 }}>
																<SummaryMetricCard label="Altura" value={formatMetric(patient.height, 'cm', 0)} />
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 4 }}>
																<SummaryMetricCard label="IMC" value={patient.bmi.toFixed(1)} />
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 4 }}>
																<SummaryMetricCard label="Atividade" value={formatActivityLevel(patient.activityLevel)} />
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 4 }}>
																<SummaryMetricCard label="TMB (BMR)" value={formatMetric(patient.bmr, 'kcal', 0)} />
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 4 }}>
																<SummaryMetricCard label="GET (TDEE)" value={formatTdee(patient.tdee)} />
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 3 }}>
																<SummaryMetricCard
																	label="Circ. braco"
																	value={formatOptionalMetric(patient.armCircumference, 'cm')}
																/>
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 3 }}>
																<SummaryMetricCard
																	label="Circ. cintura"
																	value={formatOptionalMetric(patient.waistCircumference, 'cm')}
																/>
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 3 }}>
																<SummaryMetricCard
																	label="Circ. quadril"
																	value={formatOptionalMetric(patient.hipCircumference, 'cm')}
																/>
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 3 }}>
																<SummaryMetricCard
																	label="Circ. coxa"
																	value={formatOptionalMetric(patient.thighCircumference, 'cm')}
																/>
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 3 }}>
																<SummaryMetricCard
																	label="Dobra subescapular"
																	value={formatOptionalMetric(patient.subscapularSkinfold, 'mm')}
																/>
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 3 }}>
																<SummaryMetricCard
																	label="Dobra axilar media"
																	value={formatOptionalMetric(patient.axillarySkinfold, 'mm')}
																/>
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 3 }}>
																<SummaryMetricCard
																	label="Dobra suprailiaca"
																	value={formatOptionalMetric(patient.suprailiacSkinfold, 'mm')}
																/>
															</Grid.Col>
															<Grid.Col span={{ base: 6, lg: 3 }}>
																<SummaryMetricCard
																	label="Dobra abdominal"
																	value={formatOptionalMetric(patient.abdominalSkinfold, 'mm')}
																/>
															</Grid.Col>
															<Grid.Col span={{ base: 12 }}>
																<SummaryMetricCard label="Objetivos" value={patientGoals} />
															</Grid.Col>
															<Grid.Col span={{ base: 12 }}>
																<SummaryMetricCard label="Condicoes medicas" value={patientMedicalConditions} />
															</Grid.Col>
														</Grid>
													</Spoiler>
												</Box>

												<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4">
													<Grid gutter="sm" align="flex-end">
														<Grid.Col span={{ base: 12, xl: 4 }}>
															<TextInput
																label="Novo grupo de refeicao"
																placeholder="Ex.: Ceia ou Pre treino"
																value={customMealGroupLabel}
																onChange={(event) => setCustomMealGroupLabel(event.currentTarget.value)}
																radius="md"
																classNames={textInputClassNames}
															/>
														</Grid.Col>
														<Grid.Col span={{ base: 12, sm: 4, xl: 2 }}>
															<Button
																type="button"
																fullWidth
																radius="md"
																classNames={neutralButtonClassNames}
																leftSection={<MdAdd size={18} />}
																onClick={handleAddMealGroup}
															>
																Adicionar grupo
															</Button>
														</Grid.Col>
														<Grid.Col span={{ base: 12, sm: 4, xl: 3 }} className="xl:ml-auto">
															<Button
																type="button"
																fullWidth
																radius="md"
																classNames={primaryButtonClassNames}
																leftSection={<MdAutoAwesome size={18} />}
																onClick={openAiSettingsModal}
																loading={isGeneratingAiMenu}
															>
																{isGeneratingAiMenu ? 'Gerando com IA' : 'Gerar com IA'}
															</Button>
														</Grid.Col>
													</Grid>
													<Text className="mt-2 text-xs font-medium text-slate-500">
														{isLoadingSavedMenu
															? 'Carregando rascunho salvo do paciente...'
															: savedMenuUpdatedAt
																? `Ultimo rascunho salvo em ${formatDateTime(savedMenuUpdatedAt)}.`
																: 'Nenhum rascunho salvo ainda para este paciente.'}
													</Text>
												</Box>

													{mealGroups.length === 0 ? (
														<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4">
															<Text className="text-sm font-medium text-slate-600">
																Nenhum grupo de refeicao criado. Adicione o primeiro grupo para iniciar.
															</Text>
													</Box>
												) : (
													mealGroups.map((group, groupIndex) => {
														const isDraggingGroup = draggingMealGroupId === group.id
														const isDropTarget = mealGroupDropTarget?.groupId === group.id && !isDraggingGroup
														const showDropBefore = isDropTarget && mealGroupDropTarget?.placement === 'before'
														const showDropAfter = isDropTarget && mealGroupDropTarget?.placement === 'after'

														return (
															<Box
																key={group.id}
																className={`relative rounded-2xl transition-all ${
																	isDraggingGroup ? 'opacity-70' : ''
																} ${
																	isDropTarget ? 'bg-cyan-50/35' : ''
																}`}
																onDragOver={(event) => handleMealGroupDragOver(event, group.id)}
																onDrop={(event) => handleMealGroupDrop(event, group.id)}
															>
																{showDropBefore ? (
																	<Box className="pointer-events-none absolute -top-[5px] left-3 right-3 z-20 h-[4px] rounded-full bg-cyan-400 shadow-[0_0_0_1px_rgba(6,182,212,0.2)]" />
																) : null}
																{showDropAfter ? (
																	<Box className="pointer-events-none absolute -bottom-[5px] left-3 right-3 z-20 h-[4px] rounded-full bg-cyan-400 shadow-[0_0_0_1px_rgba(6,182,212,0.2)]" />
																) : null}

																<Fieldset
																	legend={`${groupIndex + 1}. ${group.name.trim() || 'Nova refeicao'}`}
																	radius="md"
																	className="rounded-2xl border border-[#d2e4eb] bg-white"
																	classNames={{
																		legend: 'rounded-full border border-[#9fd0e3] bg-[#eaf7fc] px-3 py-1 text-[0.78rem] font-semibold tracking-[0.06em] text-[#1b5f7a]',
																	}}
																>
																	<Stack gap="sm">
																		<Group align="flex-end" wrap="nowrap">
																			<TextInput
																				label="Nome da refeicao"
																				placeholder="Ex.: Jantar"
																				value={group.name}
																				onChange={(event) => handleMealGroupNameChange(group.id, event.currentTarget.value)}
																				radius="md"
																				classNames={textInputClassNames}
																				className="w-full"
																			/>

																			<ActionIcon
																				variant="light"
																				color="gray"
																				radius="md"
																				size={38}
																				title="Arraste para reordenar grupo"
																				aria-label="Arraste para reordenar grupo"
																				draggable
																				className="cursor-grab active:cursor-grabbing"
																				onDragStart={(event) => handleMealGroupDragStart(event, group.id)}
																				onDragEnd={handleMealGroupDragEnd}
																			>
																				<MdDragIndicator size={18} />
																			</ActionIcon>

																			<ActionIcon
																				variant="light"
																				color="red"
																				radius="md"
																				size={38}
																				title="Remover grupo de refeicao"
																				aria-label="Remover grupo de refeicao"
																				onClick={() => handleRemoveMealGroup(group.id)}
																			>
																				<MdDeleteOutline size={18} />
																			</ActionIcon>
																		</Group>

																		{group.items.map((item, itemIndex) => (
																			<Box
																				key={item.id}
																				className="rounded-xl border border-[#e2edf3] bg-[#f9fcfe] p-3"
																			>
																				<Grid gutter="sm" align="flex-end">
																					<Grid.Col span={{ base: 12, md: 5 }}>
																							<Select
																								label={`Alimento ${itemIndex + 1}`}
																								placeholder={isLoadingTacoFoodOptions ? 'Carregando alimentos...' : 'Selecione um alimento'}
																								data={tacoFoodOptions}
																								value={item.foodId}
																								onChange={(value) => handleMealItemFoodChange(group.id, item.id, value)}
																								searchable
																								clearable
																								limit={60}
																								nothingFoundMessage="Nenhum alimento encontrado"
																								disabled={isLoadingTacoFoodOptions || tacoFoodOptions.length === 0}
																								radius="md"
																								classNames={textInputClassNames}
																							/>
																					</Grid.Col>

																					<Grid.Col span={{ base: 6, md: 3 }}>
																						<TextInput
																							label="Quantidade"
																							placeholder="Ex.: 2"
																							value={item.quantity}
																							onChange={(event) => handleMealItemFieldChange(group.id, item.id, 'quantity', event.currentTarget.value)}
																							radius="md"
																							classNames={textInputClassNames}
																						/>
																					</Grid.Col>

																					<Grid.Col span={{ base: 6, md: 3 }}>
																						<TextInput
																							label="Medida"
																							placeholder="Ex.: colheres"
																							value={item.measure}
																							onChange={(event) => handleMealItemFieldChange(group.id, item.id, 'measure', event.currentTarget.value)}
																							radius="md"
																							classNames={textInputClassNames}
																						/>
																					</Grid.Col>

																					<Grid.Col span={{ base: 12, md: 1 }}>
																						<ActionIcon
																							variant="light"
																							color="red"
																							radius="md"
																							size={36}
																							className="mb-[3px]"
																							title={group.items.length > 1 ? 'Remover alimento' : 'Adicione outro alimento para remover'}
																							aria-label="Remover alimento"
																							onClick={() => handleRemoveMealItem(group.id, item.id)}
																							disabled={group.items.length <= 1}
																						>
																							<MdDeleteOutline size={17} />
																						</ActionIcon>
																					</Grid.Col>

																					<Grid.Col span={12}>
																						<TextInput
																							label="Observacoes"
																							placeholder="Ex.: usar versao sem lactose"
																							value={item.notes}
																							onChange={(event) => handleMealItemFieldChange(group.id, item.id, 'notes', event.currentTarget.value)}
																							radius="md"
																							classNames={textInputClassNames}
																						/>
																					</Grid.Col>
																				</Grid>
																			</Box>
																		))}

																		<Group justify="space-between">
																			<Text className="text-xs font-medium text-slate-500">
																				{group.items.length} item(ns) nesta refeicao.
																			</Text>
																			<Button
																				type="button"
																				variant="subtle"
																				color="cyan"
																				radius="md"
																				leftSection={<MdAdd size={17} />}
																				onClick={() => handleAddMealItem(group.id)}
																			>
																				Adicionar alimento
																			</Button>
																		</Group>
																	</Stack>
																</Fieldset>
															</Box>
														)
														})
													)}

													<Group justify="flex-end">
														<Button
															type="button"
															radius="md"
															classNames={primaryButtonClassNames}
															rightSection={<MdArrowForward size={16} />}
															onClick={() => handleDataEntryStepChange(1)}
														>
															Avancar para orientacoes
														</Button>
													</Group>
												</Box>

												<Box className={activeDataEntryStep === 1 ? 'rounded-2xl border border-[#d2e4eb] bg-white p-4' : 'hidden'}>
													<Stack gap="sm">
														<Box className="rounded-xl border border-[#deebf2] bg-[#f8fcff] p-3">
															<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
																Orientacoes ao paciente
															</Text>
															<Text className="mt-2 text-sm text-slate-600">
																Preencha orientacoes detalhadas e acionaveis. Se preferir, use IA para gerar
																um rascunho robusto e ajuste manualmente.
															</Text>
														</Box>

														<Group justify="space-between">
															<Button
																type="button"
																radius="md"
																classNames={neutralButtonClassNames}
																leftSection={<MdArrowBack size={16} />}
																onClick={() => handleDataEntryStepChange(0)}
															>
																Voltar para itens
															</Button>
															<Button
																type="button"
																radius="md"
																classNames={primaryButtonClassNames}
																leftSection={<MdAutoAwesome size={18} />}
																onClick={handleGenerateAiGuidanceClick}
																loading={isGeneratingAiGuidance}
															>
																{isGeneratingAiGuidance ? 'Gerando orientacoes' : 'Gerar orientacoes com IA'}
															</Button>
														</Group>

														<Grid gutter="sm" align="flex-start">
															<Grid.Col span={{ base: 12, md: 4 }}>
																	<NumberInput
																		label="Meta de hidratacao (ml/dia)"
																		placeholder="Ex.: 3200"
																		value={nutritionGuidance.hydrationGoalMl ?? undefined}
																		onChange={handleNutritionGuidanceHydrationGoalChange}
																	min={1200}
																	max={7000}
																	step={100}
																	allowDecimal={false}
																	radius="md"
																	classNames={textInputClassNames}
																/>
															</Grid.Col>

															<Grid.Col span={{ base: 12, md: 8 }}>
																<Textarea
																	label="Rotina das refeicoes"
																	placeholder="Descreva distribuicao de horarios, intervalos e estrutura de refeicoes."
																	value={nutritionGuidance.mealRoutineGuidance}
																	onChange={(event) => handleNutritionGuidanceTextFieldChange('mealRoutineGuidance', event.currentTarget.value)}
																	autosize
																	minRows={3}
																	maxRows={6}
																	radius="md"
																	classNames={textInputClassNames}
																/>
															</Grid.Col>

															<Grid.Col span={{ base: 12, md: 6 }}>
																<Textarea
																	label="Qualidade alimentar"
																	placeholder="Inclua escolhas de alimentos, grupos prioritarios e exemplos prontos."
																	value={nutritionGuidance.foodQualityGuidance}
																	onChange={(event) => handleNutritionGuidanceTextFieldChange('foodQualityGuidance', event.currentTarget.value)}
																	autosize
																	minRows={3}
																	maxRows={6}
																	radius="md"
																	classNames={textInputClassNames}
																/>
															</Grid.Col>

															<Grid.Col span={{ base: 12, md: 6 }}>
																<Textarea
																	label="Preparo e organizacao"
																	placeholder="Oriente planejamento de compras, preparo e estrategia para rotina corrida."
																	value={nutritionGuidance.preparationGuidance}
																	onChange={(event) => handleNutritionGuidanceTextFieldChange('preparationGuidance', event.currentTarget.value)}
																	autosize
																	minRows={3}
																	maxRows={6}
																	radius="md"
																	classNames={textInputClassNames}
																/>
															</Grid.Col>

															<Grid.Col span={{ base: 12, md: 6 }}>
																<Textarea
																	label="Comportamento alimentar"
																	placeholder="Descreva tecnicas para adesao, fome emocional, mastigacao e ambiente de refeicao."
																	value={nutritionGuidance.behaviorGuidance}
																	onChange={(event) => handleNutritionGuidanceTextFieldChange('behaviorGuidance', event.currentTarget.value)}
																	autosize
																	minRows={3}
																	maxRows={6}
																	radius="md"
																	classNames={textInputClassNames}
																/>
															</Grid.Col>

															<Grid.Col span={{ base: 12, md: 6 }}>
																<Textarea
																	label="Monitoramento de sintomas"
																	placeholder="Informe sinais de alerta, evolucao esperada e quando retornar para ajuste."
																	value={nutritionGuidance.symptomMonitoringGuidance}
																	onChange={(event) => handleNutritionGuidanceTextFieldChange('symptomMonitoringGuidance', event.currentTarget.value)}
																	autosize
																	minRows={3}
																	maxRows={6}
																	radius="md"
																	classNames={textInputClassNames}
																/>
															</Grid.Col>

															<Grid.Col span={{ base: 12, md: 6 }}>
																<Textarea
																	label="Restricoes e alertas"
																	placeholder="Descreva evitacoes especificas e cuidados clinicos prioritarios."
																	value={nutritionGuidance.restrictionsGuidance}
																	onChange={(event) => handleNutritionGuidanceTextFieldChange('restrictionsGuidance', event.currentTarget.value)}
																	autosize
																	minRows={3}
																	maxRows={6}
																	radius="md"
																	classNames={textInputClassNames}
																/>
															</Grid.Col>

															<Grid.Col span={{ base: 12, md: 6 }}>
																<Textarea
																	label="Orientacoes adicionais"
																	placeholder="Inclua exemplos prontos, reforcos de adesao e observacoes finais."
																	value={nutritionGuidance.additionalGuidance}
																	onChange={(event) => handleNutritionGuidanceTextFieldChange('additionalGuidance', event.currentTarget.value)}
																	autosize
																	minRows={3}
																	maxRows={6}
																	radius="md"
																	classNames={textInputClassNames}
																/>
															</Grid.Col>
														</Grid>

															{aiGuidanceHighlights.length > 0 ? (
																<Box className="rounded-xl border border-[#d9eaf2] bg-[#f7fbff] p-3">
																<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
																	Destaques gerados pela IA
																</Text>
																<Stack gap={4} className="mt-2">
																	{aiGuidanceHighlights.map((highlight, index) => (
																		<Text key={`ai-guidance-highlight-${index}`} className="text-sm text-slate-700">
																			- {highlight}
																		</Text>
																	))}
																	</Stack>
																</Box>
															) : null}

															<Group justify="flex-end" mt="xs">
																<Button
																	type="button"
																	radius="md"
																	classNames={primaryButtonClassNames}
																	rightSection={<MdArrowForward size={16} />}
																	onClick={() => handleDataEntryStepChange(2)}
																>
																	Avancar para receitas
																</Button>
															</Group>
														</Stack>
													</Box>

													<Box className={activeDataEntryStep === 2 ? 'rounded-2xl border border-[#d2e4eb] bg-white p-4' : 'hidden'}>
														<Stack gap="sm">
															<Box className="rounded-xl border border-[#deebf2] bg-[#f8fcff] p-3">
																<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
																	Receitas sugeridas
																</Text>
																<Text className="mt-2 text-sm text-slate-600">
																	Monte receitas com base nos alimentos selecionados. Voce pode preencher
																	manualmente ou pedir para a IA gerar sugestoes completas.
																</Text>
															</Box>

															<Group justify="space-between">
																<Button
																	type="button"
																	radius="md"
																	classNames={neutralButtonClassNames}
																	leftSection={<MdArrowBack size={16} />}
																	onClick={() => handleDataEntryStepChange(1)}
																>
																	Voltar para orientacoes
																</Button>
																<Group gap="xs">
																	<Button
																		type="button"
																		radius="md"
																		classNames={neutralButtonClassNames}
																		leftSection={<MdAdd size={17} />}
																		onClick={handleAddRecipeSuggestion}
																	>
																		Adicionar receita
																	</Button>
																	<Button
																		type="button"
																		radius="md"
																		classNames={primaryButtonClassNames}
																		leftSection={<MdAutoAwesome size={18} />}
																		onClick={openAiRecipeSettingsModal}
																		loading={isGeneratingAiRecipes}
																	>
																		{isGeneratingAiRecipes ? 'Gerando receitas' : 'Gerar receitas com IA'}
																	</Button>
																</Group>
															</Group>

															<Box className="rounded-xl border border-[#d9e7ee] bg-[#f8fcff] p-3">
																<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
																	Base de alimentos selecionados
																</Text>
																{selectedFoodsForRecipes.length > 0 ? (
																	<Box className="mt-2 flex flex-wrap gap-1.5">
																		{selectedFoodsForRecipes.map((foodName) => (
																			<Text
																				key={foodName}
																				component="span"
																				className="inline-flex rounded-full border border-[#c7dce8] bg-white px-2.5 py-1 text-[0.72rem] font-medium text-slate-700"
																			>
																				{foodName}
																			</Text>
																		))}
																	</Box>
																) : (
																	<Text className="mt-2 text-sm text-slate-600">
																		Nenhum alimento selecionado ainda. Preencha os itens na Etapa 1 para gerar receitas com IA.
																	</Text>
																)}
															</Box>

															<Box className="rounded-xl border border-[#cfe0e8] bg-[#f7fbff] p-3">
																<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
																	Estrutura da receita
																</Text>
																<Text className="mt-1 text-sm text-slate-600">
																	Cada receita fica organizada em blocos para facilitar a visualizacao e o preenchimento.
																</Text>

																<Stack gap="sm" className="mt-3">
																	{recipeSuggestions.map((recipe, recipeIndex) => (
																		<Box
																			key={recipe.id}
																			className="rounded-xl border border-[#d4e5ed] bg-white p-3 md:p-4"
																		>
																			<Group justify="space-between" align="center" className="mb-2">
																				<Box>
																					<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#1c5f7a]">
																						Receita {recipeIndex + 1}
																					</Text>
																				</Box>
																				<ActionIcon
																					variant="light"
																					color="red"
																					radius="md"
																					size={34}
																					title="Remover receita sugerida"
																					aria-label="Remover receita sugerida"
																					onClick={() => handleRemoveRecipeSuggestion(recipe.id)}
																				>
																					<MdDeleteOutline size={17} />
																				</ActionIcon>
																			</Group>

																			<Grid gutter="sm" align="flex-start">
																				<Grid.Col span={{ base: 12, md: 6 }}>
																					<TextInput
																						label="Nome da receita"
																						placeholder="Ex.: Panqueca de banana e aveia"
																						value={recipe.recipeName}
																						onChange={(event) => handleRecipeSuggestionFieldChange(recipe.id, 'recipeName', event.currentTarget.value)}
																						radius="md"
																						classNames={textInputClassNames}
																					/>
																				</Grid.Col>

																				<Grid.Col span={{ base: 12, md: 6 }}>
																					<TextInput
																						label="Base de alimentos"
																						placeholder="Ex.: Banana, aveia, ovo"
																						value={recipe.basedOnFoods}
																						onChange={(event) => handleRecipeSuggestionFieldChange(recipe.id, 'basedOnFoods', event.currentTarget.value)}
																						radius="md"
																						classNames={textInputClassNames}
																					/>
																				</Grid.Col>

																				<Grid.Col span={{ base: 12, md: 6 }}>
																					<Textarea
																						label="Ingredientes"
																						placeholder="Ex.: 1 banana\n2 colheres de aveia\n1 ovo"
																						value={recipe.ingredients}
																						onChange={(event) => handleRecipeSuggestionFieldChange(recipe.id, 'ingredients', event.currentTarget.value)}
																						autosize
																						minRows={3}
																						maxRows={6}
																						radius="md"
																						classNames={textInputClassNames}
																					/>
																				</Grid.Col>

																				<Grid.Col span={{ base: 12, md: 6 }}>
																					<Textarea
																						label="Modo de preparo"
																						placeholder="Ex.: Misture os ingredientes e cozinhe em fogo medio por 3 minutos."
																						value={recipe.preparationMethod}
																						onChange={(event) => handleRecipeSuggestionFieldChange(recipe.id, 'preparationMethod', event.currentTarget.value)}
																						autosize
																						minRows={3}
																						maxRows={6}
																						radius="md"
																						classNames={textInputClassNames}
																					/>
																				</Grid.Col>

																				<Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
																					<TextInput
																						label="Rendimento"
																						placeholder="Ex.: 2 porcoes"
																						value={recipe.yieldInfo}
																						onChange={(event) => handleRecipeSuggestionFieldChange(recipe.id, 'yieldInfo', event.currentTarget.value)}
																						radius="md"
																						classNames={textInputClassNames}
																					/>
																				</Grid.Col>

																				<Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
																					<TextInput
																						label="Quantidade por porcao"
																						placeholder="Ex.: 1 porcao (180 g)"
																						value={recipe.portionQuantity}
																						onChange={(event) => handleRecipeSuggestionFieldChange(recipe.id, 'portionQuantity', event.currentTarget.value)}
																						radius="md"
																						classNames={textInputClassNames}
																					/>
																				</Grid.Col>
																			</Grid>
																		</Box>
																	))}
																</Stack>
															</Box>
														</Stack>
													</Box>

												</Stack>
										</Box>
									</Grid.Col>

										{/* Divisor visual entre area de edicao (esquerda) e preview (direita). */}
										<Grid.Col
											span={{ base: 12, md: 1 }}
											className="flex h-full min-h-0 items-stretch justify-center"
										>
										<Divider orientation="vertical" size="sm" className="hidden md:block" />
										<Divider orientation="horizontal" size="sm" className="my-1 w-full md:hidden" />
									</Grid.Col>

										{/* COLUNA DIREITA: espaco de preview PDF e roadmap de incrementos. */}
										<Grid.Col span={{ base: 12, md: 4 }} className="h-full min-h-0">
										<Box className="h-full min-h-0 rounded-[18px] border border-[#d5e4eb] bg-white/80 p-3 md:p-4">
												<Stack gap="md" className="h-full min-h-0">
													{/* Cabecalho da area de preview PDF. */}
													{/* Resumo clinico expandivel do paciente para apoiar decisao do nutricionista. */}
													{/* Resumo clinico expandivel do paciente para apoiar decisao do nutricionista. */}
													<Box className="rounded-2xl border border-[#d2e4eb] bg-[linear-gradient(125deg,rgba(39,144,176,0.12)_0%,rgba(148,186,101,0.13)_52%,rgba(255,255,255,0.98)_100%)] p-4">
													<Text className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
														Canvas do PDF
													</Text>
													<Text className="mt-2 text-sm text-slate-600">
														Area reservada para renderizar o PDF do cardapio do paciente.
													</Text>
												</Box>

													<Box className="min-h-[360px] flex-1">
														<MealPlanPdfCanvasPreview
															patient={patient}
															mealGroups={debouncedMealGroups}
															orientationTips={nutritionGuidanceTipsForPdf}
															nutritionPreview={planNutritionPreview}
															recipeSuggestions={debouncedRecipeSuggestions}
															nutritionistProfile={nutritionistProfileForPdf}
															showDownloadButton={false}
															onPdfBlobStateChange={handlePdfBlobStateChange}
														/>
													</Box>

													<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4">
														<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
															Funções de exportação e salvamento
														</Text>
														<Text className="mt-2 text-sm text-slate-600">
															Após gerar o cardápio, use os botões abaixo para baixar o PDF ou salvar um rascunho do plano no paciente.
														</Text>
														<Group className="mt-3" gap="sm" grow>
															{pdfDownloadUrl ? (
																<Button
																	type="button"
																	component="a"
																	href={pdfDownloadUrl}
																	download={pdfDownloadFileName}
																	radius="md"
																	classNames={neutralButtonClassNames}
																	leftSection={<MdDownload size={18} />}
																	loading={isGeneratingPdfBlob}
																>
																	Baixar PDF local
																</Button>
															) : (
																<Button
																	type="button"
																	radius="md"
																	classNames={neutralButtonClassNames}
																	leftSection={<MdDownload size={18} />}
																	disabled
																	loading={isGeneratingPdfBlob}
																>
																	Baixar PDF local
																</Button>
															)}
															<Button
																type="button"
																radius="md"
																classNames={neutralButtonClassNames}
																leftSection={<MdSave size={18} />}
																onClick={handleSaveMenuDraftClick}
																loading={isSavingMenuDraft}
																disabled={isLoadingSavedMenu}
															>
																{isSavingMenuDraft ? 'Salvando...' : 'Salvar cardapio'}
															</Button>
														</Group>
														{pdfGenerationErrorMessage ? (
															<Text className="mt-2 text-xs font-medium text-red-600">
																Erro na geracao do PDF: {pdfGenerationErrorMessage}
															</Text>
														) : null}
													</Box>
											</Stack>
										</Box>
									</Grid.Col>
								</Grid>
							</Box>
						) : (
							<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-5">
								<Text className="text-sm font-semibold text-slate-700">
									Paciente indisponivel para exibicao.
								</Text>
							</Box>
						)}
						</PageContentContainer>
					</Box>
				</Box>

					{/* MODAL DE PARAMETRIZACAO DA IA: nutricionista define estrategia antes de gerar. */}
					<Modal
						opened={isAiSettingsModalOpen}
						onClose={closeAiSettingsModal}
						title="Parametros da geracao com IA"
						centered
						withCloseButton={!isGeneratingAiMenu}
						closeOnClickOutside={!isGeneratingAiMenu}
						closeOnEscape={!isGeneratingAiMenu}
						size="lg"
						classNames={modalClassNames}
					>
						<Box className="p-5">
							<Stack gap="sm">
								<Text className="text-sm text-slate-700">
									Ajuste os parametros antes de enviar para o modelo e gerar os grupos.
								</Text>

						<Grid gutter="sm">
							<Grid.Col span={{ base: 12, md: 6 }}>
								<Select
									label="Foco do plano"
									data={AI_PLANNING_FOCUS_OPTIONS}
									value={aiGenerationSettings.planningFocus}
									onChange={(value) => {
										if (!value) {
											return
										}

										setAiGenerationSettings((previousSettings) => ({
											...previousSettings,
											planningFocus: value as AiPlanningFocus,
										}))
									}}
									radius="md"
									classNames={textInputClassNames}
								/>
							</Grid.Col>

							<Grid.Col span={{ base: 12, md: 6 }}>
								<Select
									label="Rigor clinico"
									data={AI_CLINICAL_STRICTNESS_OPTIONS}
									value={aiGenerationSettings.clinicalStrictness}
									onChange={(value) => {
										if (!value) {
											return
										}

										setAiGenerationSettings((previousSettings) => ({
											...previousSettings,
											clinicalStrictness: value as AiClinicalStrictness,
										}))
									}}
									radius="md"
									classNames={textInputClassNames}
								/>
							</Grid.Col>

							<Grid.Col span={{ base: 12, md: 6 }}>
								<Select
									label="Perfil de preparo"
									data={AI_PREPARATION_PROFILE_OPTIONS}
									value={aiGenerationSettings.preparationProfile}
									onChange={(value) => {
										if (!value) {
											return
										}

										setAiGenerationSettings((previousSettings) => ({
											...previousSettings,
											preparationProfile: value as AiPreparationProfile,
										}))
									}}
									radius="md"
									classNames={textInputClassNames}
								/>
							</Grid.Col>

							<Grid.Col span={{ base: 12, md: 6 }}>
								<Select
									label="Perfil de orcamento"
									data={AI_BUDGET_PROFILE_OPTIONS}
									value={aiGenerationSettings.budgetProfile}
									onChange={(value) => {
										if (!value) {
											return
										}

										setAiGenerationSettings((previousSettings) => ({
											...previousSettings,
											budgetProfile: value as AiBudgetProfile,
										}))
									}}
									radius="md"
									classNames={textInputClassNames}
								/>
							</Grid.Col>

							<Grid.Col span={{ base: 12, md: 6 }}>
								<NumberInput
									label="Maximo de itens por grupo"
									value={aiGenerationSettings.maxItemsPerGroup}
									onChange={(value) => {
										setAiGenerationSettings((previousSettings) => ({
											...previousSettings,
											maxItemsPerGroup: typeof value === 'number' && Number.isFinite(value)
												? Math.min(Math.max(Math.round(value), 2), 6)
												: previousSettings.maxItemsPerGroup,
										}))
									}}
									min={2}
									max={6}
									step={1}
									radius="md"
									classNames={textInputClassNames}
								/>
							</Grid.Col>

							<Grid.Col span={{ base: 12, md: 6 }}>
								<Select
									label="Modelo IA (opcional)"
									placeholder={backendDefaultAiModel ? `Padrao: ${backendDefaultAiModel}` : 'Padrao do backend'}
									data={aiModelOptions}
									value={aiGenerationSettings.modelOverride}
									onChange={(value) => {
										setAiGenerationSettings((previousSettings) => ({
											...previousSettings,
											modelOverride: value,
										}))
									}}
									searchable
									clearable
									disabled={isLoadingAiModels}
									radius="md"
									classNames={textInputClassNames}
								/>
							</Grid.Col>

							<Grid.Col span={12}>
								<TextInput
									label="Preferir alimentos (opcional)"
									placeholder="Ex.: ovos, frango, iogurte natural, aveia"
									value={aiGenerationSettings.preferredFoods}
									onChange={(event) => {
										setAiGenerationSettings((previousSettings) => ({
											...previousSettings,
											preferredFoods: event.currentTarget.value,
										}))
									}}
									radius="md"
									classNames={textInputClassNames}
								/>
							</Grid.Col>

							<Grid.Col span={12}>
								<TextInput
									label="Evitar alimentos (opcional)"
									placeholder="Ex.: leite, gluten, amendoim"
									value={aiGenerationSettings.restrictedFoods}
									onChange={(event) => {
										setAiGenerationSettings((previousSettings) => ({
											...previousSettings,
											restrictedFoods: event.currentTarget.value,
										}))
									}}
									radius="md"
									classNames={textInputClassNames}
								/>
							</Grid.Col>

							<Grid.Col span={12}>
								<Textarea
									label="Instrucoes extras (opcional)"
									placeholder="Ex.: priorizar opcoes para marmita e lanches de facil transporte"
									value={aiGenerationSettings.extraInstructions}
									onChange={(event) => {
										setAiGenerationSettings((previousSettings) => ({
											...previousSettings,
											extraInstructions: event.currentTarget.value,
										}))
									}}
									minRows={3}
									maxRows={5}
									autosize
									radius="md"
									classNames={textInputClassNames}
								/>
							</Grid.Col>
						</Grid>

						<Group justify="flex-end" mt="xs">
							<Button
								type="button"
								radius="md"
								classNames={neutralButtonClassNames}
								onClick={closeAiSettingsModal}
								disabled={isGeneratingAiMenu}
								className={modalActionButtonSizeClassName}
							>
								Cancelar
							</Button>
							<Button
								type="button"
								radius="md"
								classNames={primaryButtonClassNames}
								onClick={handleConfirmAiGenerate}
								loading={isGeneratingAiMenu}
								className={modalActionButtonSizeClassName}
							>
								Gerar sugestoes
							</Button>
						</Group>
					</Stack>
				</Box>
				</Modal>

				<Modal
					opened={isAiRecipeSettingsModalOpen}
					onClose={closeAiRecipeSettingsModal}
					title="Parametros da geracao de receitas com IA"
					centered
					withCloseButton={!isGeneratingAiRecipes}
					closeOnClickOutside={!isGeneratingAiRecipes}
					closeOnEscape={!isGeneratingAiRecipes}
					size="lg"
					classNames={modalClassNames}
				>
					<Box className="p-5">
						<Stack gap="sm">
							<Text className="text-sm text-slate-700">
								Defina os parametros para controlar melhor o formato das receitas que a IA vai sugerir.
							</Text>

							<Grid gutter="sm">
								<Grid.Col span={{ base: 12, md: 6 }}>
									<Select
										label="Foco das receitas"
										data={AI_RECIPE_FOCUS_OPTIONS}
										value={aiRecipeGenerationSettings.recipeFocus}
										onChange={(value) => {
											if (!value) {
												return
											}

											setAiRecipeGenerationSettings((previousSettings) => ({
												...previousSettings,
												recipeFocus: value as AiRecipeFocus,
											}))
										}}
										radius="md"
										classNames={textInputClassNames}
									/>
								</Grid.Col>

								<Grid.Col span={{ base: 12, md: 6 }}>
									<Select
										label="Perfil de preparo"
										data={AI_PREPARATION_PROFILE_OPTIONS}
										value={aiRecipeGenerationSettings.preparationProfile}
										onChange={(value) => {
											if (!value) {
												return
											}

											setAiRecipeGenerationSettings((previousSettings) => ({
												...previousSettings,
												preparationProfile: value as AiPreparationProfile,
											}))
										}}
										radius="md"
										classNames={textInputClassNames}
									/>
								</Grid.Col>

								<Grid.Col span={{ base: 12, md: 6 }}>
									<Select
										label="Perfil de orcamento"
										data={AI_BUDGET_PROFILE_OPTIONS}
										value={aiRecipeGenerationSettings.budgetProfile}
										onChange={(value) => {
											if (!value) {
												return
											}

											setAiRecipeGenerationSettings((previousSettings) => ({
												...previousSettings,
												budgetProfile: value as AiBudgetProfile,
											}))
										}}
										radius="md"
										classNames={textInputClassNames}
									/>
								</Grid.Col>

								<Grid.Col span={{ base: 12, md: 6 }}>
									<NumberInput
										label="Quantidade de receitas"
										value={aiRecipeGenerationSettings.recipeCount}
										onChange={(value) => {
											setAiRecipeGenerationSettings((previousSettings) => ({
												...previousSettings,
												recipeCount: typeof value === 'number' && Number.isFinite(value)
													? Math.min(Math.max(Math.round(value), 2), 8)
													: previousSettings.recipeCount,
											}))
										}}
										min={2}
										max={8}
										step={1}
										allowDecimal={false}
										radius="md"
										classNames={textInputClassNames}
									/>
								</Grid.Col>

								<Grid.Col span={{ base: 12, md: 6 }}>
									<NumberInput
										label="Maximo de ingredientes/receita"
										value={aiRecipeGenerationSettings.maxIngredientsPerRecipe}
										onChange={(value) => {
											setAiRecipeGenerationSettings((previousSettings) => ({
												...previousSettings,
												maxIngredientsPerRecipe: typeof value === 'number' && Number.isFinite(value)
													? Math.min(Math.max(Math.round(value), 3), 12)
													: previousSettings.maxIngredientsPerRecipe,
											}))
										}}
										min={3}
										max={12}
										step={1}
										allowDecimal={false}
										radius="md"
										classNames={textInputClassNames}
									/>
								</Grid.Col>

								<Grid.Col span={{ base: 12, md: 6 }}>
									<Select
										label="Modelo IA (opcional)"
										placeholder={backendDefaultAiModel ? `Padrao: ${backendDefaultAiModel}` : 'Padrao do backend'}
										data={aiModelOptions}
										value={aiRecipeGenerationSettings.modelOverride}
										onChange={(value) => {
											setAiRecipeGenerationSettings((previousSettings) => ({
												...previousSettings,
												modelOverride: value,
											}))
										}}
										searchable
										clearable
										disabled={isLoadingAiModels}
										radius="md"
										classNames={textInputClassNames}
									/>
								</Grid.Col>

								<Grid.Col span={12}>
									<TextInput
										label="Preferir ingredientes (opcional)"
										placeholder="Ex.: frango, iogurte natural, aveia, batata doce"
										value={aiRecipeGenerationSettings.preferredFoods}
										onChange={(event) => {
											setAiRecipeGenerationSettings((previousSettings) => ({
												...previousSettings,
												preferredFoods: event.currentTarget.value,
											}))
										}}
										radius="md"
										classNames={textInputClassNames}
									/>
								</Grid.Col>

								<Grid.Col span={12}>
									<TextInput
										label="Evitar ingredientes (opcional)"
										placeholder="Ex.: leite, amendoim, farinha de trigo"
										value={aiRecipeGenerationSettings.restrictedFoods}
										onChange={(event) => {
											setAiRecipeGenerationSettings((previousSettings) => ({
												...previousSettings,
												restrictedFoods: event.currentTarget.value,
											}))
										}}
										radius="md"
										classNames={textInputClassNames}
									/>
								</Grid.Col>

								<Grid.Col span={12}>
									<Textarea
										label="Instrucoes extras (opcional)"
										placeholder="Ex.: priorizar receitas para marmita, evitar fritura e manter preparo em ate 20 minutos"
										value={aiRecipeGenerationSettings.extraInstructions}
										onChange={(event) => {
											setAiRecipeGenerationSettings((previousSettings) => ({
												...previousSettings,
												extraInstructions: event.currentTarget.value,
											}))
										}}
										minRows={3}
										maxRows={5}
										autosize
										radius="md"
										classNames={textInputClassNames}
									/>
								</Grid.Col>
							</Grid>

							<Group justify="flex-end" mt="xs">
								<Button
									type="button"
									radius="md"
									classNames={neutralButtonClassNames}
									onClick={closeAiRecipeSettingsModal}
									disabled={isGeneratingAiRecipes}
									className={modalActionButtonSizeClassName}
								>
									Cancelar
								</Button>
								<Button
									type="button"
									radius="md"
									classNames={primaryButtonClassNames}
									onClick={handleConfirmAiRecipeGenerate}
									loading={isGeneratingAiRecipes}
									className={modalActionButtonSizeClassName}
								>
									Gerar receitas
								</Button>
							</Group>
						</Stack>
					</Box>
				</Modal>

					{/* OVERLAY GLOBAL DE PROCESSAMENTO: bloqueia interacao enquanto a IA esta rodando. */}
					{isGeneratingAiMenu ? (
						<Box className="fixed inset-0 z-[1600]">
							<LoadingOverlay
								visible={true}
								zIndex={1600}
								overlayProps={{
									blur: 3,
									backgroundOpacity: 0.6,
									color: '#041723',
								}}
								loaderProps={{
									type: 'bars',
									size: 'xl',
									color: 'cyan',
								}}
							/>
							<Box className="pointer-events-none absolute left-1/2 top-1/2 z-[1601] w-full max-w-[980px] -translate-x-1/2 px-4 pt-16 text-center">
								<Text className="text-base font-semibold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] md:text-lg">
									Gerando sugestoes para {patient?.name ?? 'paciente'}
								</Text>
								<Text className="mt-1 text-sm text-cyan-100/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)]">
									{aiGenerationStatusMessage}
								</Text>
									<Text className="mt-2 text-xs font-medium text-cyan-100/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)]">
										Etapa {aiGenerationStep} de {AI_GENERATION_TOTAL_STEPS} | Tempo: {aiGenerationElapsedSeconds}s | Modelo: {effectiveAiMenuModelLabel} | Grupos: {mealGroups.length} | Itens: {totalCurrentMealItems}
									</Text>
							</Box>
						</Box>
					) : null}

					{isGeneratingAiGuidance ? (
						<Box className="fixed inset-0 z-[1610]">
							<LoadingOverlay
								visible={true}
								zIndex={1610}
								overlayProps={{
									blur: 3,
									backgroundOpacity: 0.6,
									color: '#041723',
								}}
								loaderProps={{
									type: 'bars',
									size: 'xl',
									color: 'cyan',
								}}
							/>
							<Box className="pointer-events-none absolute left-1/2 top-1/2 z-[1611] w-full max-w-[980px] -translate-x-1/2 px-4 pt-16 text-center">
								<Text className="text-base font-semibold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] md:text-lg">
									Gerando orientacoes para {patient?.name ?? 'paciente'}
								</Text>
								<Text className="mt-1 text-sm text-cyan-100/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)]">
									{aiGuidanceGenerationStatusMessage}
								</Text>
									<Text className="mt-2 text-xs font-medium text-cyan-100/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)]">
										Etapa {aiGuidanceGenerationStep} de {AI_GUIDANCE_GENERATION_TOTAL_STEPS} | Tempo: {aiGuidanceGenerationElapsedSeconds}s | Modelo: {effectiveAiGuidanceModelLabel} | Campos preenchidos: {filledNutritionGuidanceFieldsCount} | Destaques: {aiGuidanceHighlights.length}
									</Text>
							</Box>
						</Box>
					) : null}

					{isGeneratingAiRecipes ? (
						<Box className="fixed inset-0 z-[1620]">
							<LoadingOverlay
								visible={true}
								zIndex={1620}
								overlayProps={{
									blur: 3,
									backgroundOpacity: 0.6,
									color: '#041723',
								}}
								loaderProps={{
									type: 'bars',
									size: 'xl',
									color: 'cyan',
								}}
							/>
							<Box className="pointer-events-none absolute left-1/2 top-1/2 z-[1621] w-full max-w-[980px] -translate-x-1/2 px-4 pt-16 text-center">
								<Text className="text-base font-semibold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] md:text-lg">
									Gerando receitas para {patient?.name ?? 'paciente'}
								</Text>
								<Text className="mt-1 text-sm text-cyan-100/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)]">
									{aiRecipeGenerationStatusMessage}
								</Text>
									<Text className="mt-2 text-xs font-medium text-cyan-100/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)]">
										Etapa {aiRecipeGenerationStep} de {AI_RECIPE_GENERATION_TOTAL_STEPS} | Tempo: {aiRecipeGenerationElapsedSeconds}s | Modelo: {effectiveAiRecipeModelLabel} | Receitas: {filledRecipeSuggestionsCount}/{recipeSuggestions.length} | Alimentos base: {selectedFoodsForRecipes.length}
									</Text>
							</Box>
						</Box>
					) : null}
				</Box>
			)
		}
