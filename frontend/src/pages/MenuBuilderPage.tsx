import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { ActionIcon, Box, Button, Divider, Fieldset, Grid, Group, LoadingOverlay, Modal, NumberInput, Select, Skeleton, Spoiler, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useNavigate, useParams } from 'react-router-dom'
import { MdAdd, MdAutoAwesome, MdDeleteOutline, MdDragIndicator, MdPictureAsPdf } from 'react-icons/md'

import TextInputStyle from '../components/mantine/inputs/TextInput.module.css'
import ButtonStyle from '../components/mantine/buttons/PrimaryButton.module.css'

import { SideBar } from '../components/custom/sidebar/SideBar'
import { PageInfo } from '../components/custom/pageInfo/PageInfo'
import { PageContentContainer } from '../components/custom/pageContentContainer/PageContentContainer'

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

type AiModelsApiResponse = {
	model?: string
	availableModels?: string[]
	message?: string
}

type SummaryMetricCardProps = {
	label: string
	value: string
}

// CONFIGURACOES E CONSTANTES:
// Textos padrao, labels de opcoes e defaults usados em toda a pagina.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
const LOAD_PATIENT_ERROR_MESSAGE = 'Nao foi possivel carregar os dados do paciente.'
const GENERATE_MENU_ERROR_MESSAGE = 'Nao foi possivel gerar o cardapio com IA.'
const DEFAULT_MEAL_GROUP_LABELS = [
	'Cafe da manha',
	'Lanche da manha',
	'Almoco',
	'Lanche da tarde',
	'Jantar',
]
const AI_GENERATION_TOTAL_STEPS = 5
const AI_GENERATION_INITIAL_STATUS = 'Preparando dados do paciente e do cardapio...'
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

// UTILITARIOS BASICOS:
// Funcoes de infraestrutura para URL, IDs e estruturas iniciais do formulario.
function buildApiUrl(path: string) {
	if (!API_BASE_URL) {
		return path
	}

	return `${API_BASE_URL}${path}`
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
	const { token, logout } = useAuth()

	// ESTADO LOCAL DA TELA:
	// Controla dados carregados, formulario do cardapio, modal e progresso da geracao com IA.
	const [patient, setPatient] = useState<PatientMenuDataResponse | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [customMealGroupLabel, setCustomMealGroupLabel] = useState('')
	const [mealGroups, setMealGroups] = useState<MealGroupState[]>(() => getInitialMealGroups())
	const [tacoFoodOptions, setTacoFoodOptions] = useState<TacoFoodOption[]>([])
	const [isLoadingTacoFoodOptions, setIsLoadingTacoFoodOptions] = useState(true)
	const [isGeneratingAiMenu, setIsGeneratingAiMenu] = useState(false)
	const [aiGenerationStep, setAiGenerationStep] = useState(1)
	const [aiGenerationStatusMessage, setAiGenerationStatusMessage] = useState(AI_GENERATION_INITIAL_STATUS)
	const [aiGenerationStartedAt, setAiGenerationStartedAt] = useState<number | null>(null)
	const [aiGenerationElapsedSeconds, setAiGenerationElapsedSeconds] = useState(0)
	const [isAiSettingsModalOpen, setIsAiSettingsModalOpen] = useState(false)
	const [aiGenerationSettings, setAiGenerationSettings] = useState<AiGenerationSettingsState>(() => AI_GENERATION_DEFAULT_SETTINGS)
	const [aiAvailableModels, setAiAvailableModels] = useState<string[]>([])
	const [backendDefaultAiModel, setBackendDefaultAiModel] = useState<string | null>(null)
	const [isLoadingAiModels, setIsLoadingAiModels] = useState(false)
	const [draggingMealGroupId, setDraggingMealGroupId] = useState<string | null>(null)
	const [mealGroupDropTarget, setMealGroupDropTarget] = useState<{
		groupId: string
		placement: MealGroupDropPlacement
	} | null>(null)

	// MEMOIZACAO DE LOOKUPS/ENTRADAS DERIVADAS:
	// Evita recalculos desnecessarios a cada render.
	const tacoFoodLabelById = useMemo(
		() => new Map(tacoFoodOptions.map((option) => [option.value, option.label])),
		[tacoFoodOptions],
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

	const aiModelOptions = useMemo(
		() => aiAvailableModels.map((modelName) => ({ value: modelName, label: modelName })),
		[aiAvailableModels],
	)

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

				setTacoFoodOptions(buildTacoFoodOptions(tacoModule.default))
			} catch {
				if (!isMounted) {
					return
				}

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
		if (!isAiSettingsModalOpen || !token) {
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
	}, [isAiSettingsModalOpen, logout, token])

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
	const effectiveAiModelLabel = aiGenerationSettings.modelOverride?.trim() || backendDefaultAiModel || 'Padrao do backend'

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

	const openAiSettingsModal = () => {
		if (!patient) {
			notifications.show({
				title: 'Geracao com IA',
				message: 'Dados do paciente indisponiveis para gerar cardapio.',
				color: 'red',
			})
			return
		}

		setIsAiSettingsModalOpen(true)
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
			notifications.show({
				title: 'Geracao com IA',
				message: 'Dados do paciente indisponiveis para gerar cardapio.',
				color: 'red',
			})
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

			notifications.show({
				title: 'Cardapio gerado com IA',
				message: unmatchedFoods.length > 0
					? `${unmatchedFoods.length} alimento(s) nao foi(ram) mapeado(s) automaticamente na TACO. Revise os itens com observacao.`
					: 'Cardapio aplicado com sucesso.',
				color: unmatchedFoods.length > 0 ? 'yellow' : 'teal',
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : GENERATE_MENU_ERROR_MESSAGE
			notifications.show({
				title: 'Erro na geracao com IA',
				message,
				color: 'red',
			})
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
														<Grid.Col span={{ base: 12, xl: 6 }}>
															<TextInput
																label="Novo grupo de refeicao"
																placeholder="Ex.: Ceia ou Pre treino"
																value={customMealGroupLabel}
																onChange={(event) => setCustomMealGroupLabel(event.currentTarget.value)}
																radius="md"
																classNames={textInputClassNames}
															/>
														</Grid.Col>
														<Grid.Col span={{ base: 12, sm: 6, xl: 3 }}>
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
															<Grid.Col span={{ base: 12, sm: 6, xl: 3 }}>
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
													<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4">
													<Text className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
														Canvas do PDF
													</Text>
													<Text className="mt-2 text-sm text-slate-600">
														Area reservada para renderizar o PDF do cardapio do paciente.
													</Text>
												</Box>

												<Box className="flex min-h-[360px] flex-1 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#c8d7df] bg-[linear-gradient(180deg,#f9fcff_0%,#f1f7fb_100%)] px-4 py-8 text-center">
													<MdPictureAsPdf size={58} className="text-[#8fa7b5]" />
													<Text className="mt-4 text-base font-semibold text-slate-900">
														Preview do PDF em breve
													</Text>
													<Text className="mt-2 max-w-[280px] text-sm text-slate-600">
														Quando a geracao estiver pronta, o canvas com as paginas do PDF sera exibido aqui.
													</Text>
													<Button type="button" radius="md" className="mt-5" classNames={neutralButtonClassNames} disabled>
														Exportar PDF
													</Button>
												</Box>

													{/* Barra de acoes do editor: novo grupo + disparo da geracao com IA. */}
													{/* Barra de acoes do editor: novo grupo + disparo da geracao com IA. */}
													<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-4">
													<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
														Proximos incrementos
													</Text>
													<Text className="mt-2 text-sm text-slate-600">
														Persistencia do cardapio por paciente, IA para sugestao automatica e exportacao final.
													</Text>
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
									Etapa {aiGenerationStep} de {AI_GENERATION_TOTAL_STEPS} | Tempo: {aiGenerationElapsedSeconds}s | Modelo: {effectiveAiModelLabel} | Grupos: {mealGroups.length} | Itens: {totalCurrentMealItems}
								</Text>
							</Box>
						</Box>
					) : null}
			</Box>
		)
	}
