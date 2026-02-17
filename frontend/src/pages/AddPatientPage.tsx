import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
	Box,
	Button,
	Grid,
	Group,
	MultiSelect,
	NumberInput,
	Select,
	Stack,
	Text,
	TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IoAlertCircleOutline, IoCheckmarkCircleOutline } from 'react-icons/io5'
import { useNavigate, useParams } from 'react-router-dom'

import TextInputStyle from '../components/mantine/inputs/TextInput.module.css'
import ButtonStyle from '../components/mantine/buttons/PrimaryButton.module.css'
import NotificationStyle from '../components/mantine/notifications/Notification.module.css'

import { SideBar } from '../components/custom/sidebar/SideBar'
import { PageInfo } from '../components/custom/pageInfo/PageInfo'
import { PageContentContainer } from '../components/custom/pageContentContainer/PageContentContainer'

import SplitText from '../components/react-bits/SplitText'
import { useAuth } from '../auth/AuthContext'
import { maskBirthDateInput, toPostgresTimestamptz } from '../functions/date'
import { APP_SIDEBAR_ITEMS } from '../lib/sidebarItems'

// ---------------------------------------------------------------------------
// Tipos de dados
// ---------------------------------------------------------------------------
// Tipo generico dos campos numericos do formulario.
type NumericInputValue = number | string

// Estado local completo da tela de cadastro de paciente.
type PatientFormState = {
	name: string
	birthDate: string
	gender: string | null
	weight: NumericInputValue
	height: NumericInputValue
	goal: string[]
	activityLevel: string | null
	medicalConditions: string[]
	armCircumference: NumericInputValue
	waistCircumference: NumericInputValue
	hipCircumference: NumericInputValue
	thighCircumference: NumericInputValue
	subscapularSkinfold: NumericInputValue
	axillarySkinfold: NumericInputValue
	suprailiacSkinfold: NumericInputValue
	abdominalSkinfold: NumericInputValue
}

// Campos numericos editaveis que usam o mesmo handler.
type NumericFieldKey =
	| 'weight'
	| 'height'
	| 'armCircumference'
	| 'waistCircumference'
	| 'hipCircumference'
	| 'thighCircumference'
	| 'subscapularSkinfold'
	| 'axillarySkinfold'
	| 'suprailiacSkinfold'
	| 'abdominalSkinfold'

// Payload enviado ao backend para criacao do paciente.
type CreatePatientRequest = {
	name: string
	birthDate: string
	gender: string
	weight: number
	height: number
	bmi: number
	goal: string[]
	activityLevel: string
	medicalConditions: string[]
	armCircumference: number | null
	waistCircumference: number | null
	hipCircumference: number | null
	thighCircumference: number | null
	subscapularSkinfold: number | null
	axillarySkinfold: number | null
	suprailiacSkinfold: number | null
	abdominalSkinfold: number | null
	bmr: number
	tdee: number
}

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

// Campos obrigatorios monitorados para estado de erro visual.
type RequiredFieldKey =
	| 'name'
	| 'birthDate'
	| 'gender'
	| 'weight'
	| 'height'
	| 'goal'
	| 'activityLevel'
	| 'bmi'
	| 'bmr'
	| 'tdee'

type RequiredFieldErrors = Partial<Record<RequiredFieldKey, string>>

// ---------------------------------------------------------------------------
// Configuracao da pagina
// ---------------------------------------------------------------------------
// URL base da API (com fallback para chamadas relativas).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''

// Mensagens de erro padrao da tela.
const CREATE_PATIENT_ERROR_MESSAGE = 'Nao foi possivel salvar o paciente.'
const UPDATE_PATIENT_ERROR_MESSAGE = 'Nao foi possivel atualizar o paciente.'
const LOAD_PATIENT_ERROR_MESSAGE = 'Nao foi possivel carregar os dados do paciente para edicao.'
const REQUIRED_FIELDS_ERROR_MESSAGE = 'Preencha todos os campos obrigatorios antes de salvar.'
const INVALID_BIRTH_DATE_MESSAGE = 'Informe uma data valida no formato dd/mm/aaaa.'

// Estado inicial para limpeza total do formulario.
const initialPatientForm: PatientFormState = {
	name: '',
	birthDate: '',
	gender: null,
	weight: '',
	height: '',
	goal: [],
	activityLevel: null,
	medicalConditions: [],
	armCircumference: '',
	waistCircumference: '',
	hipCircumference: '',
	thighCircumference: '',
	subscapularSkinfold: '',
	axillarySkinfold: '',
	suprailiacSkinfold: '',
	abdominalSkinfold: '',
}

// ---------------------------------------------------------------------------
// Opcoes de campos de selecao
// ---------------------------------------------------------------------------
const genderOptions = [
	{ value: 'female', label: 'Feminino' },
	{ value: 'male', label: 'Masculino' },
	{ value: 'other', label: 'Outro' },
]

const activityLevelOptions = [
	{ value: 'sedentary', label: 'Sedentario' },
	{ value: 'light', label: 'Leve (1-2x por semana)' },
	{ value: 'moderate', label: 'Moderado (3-4x por semana)' },
	{ value: 'intense', label: 'Intenso (5-6x por semana)' },
	{ value: 'very-intense', label: 'Muito intenso (atleta)' },
]

const goalOptions = [
	{ value: 'weight-loss', label: 'Emagrecimento' },
	{ value: 'muscle-gain', label: 'Ganho de massa muscular' },
	{ value: 'dietary-reeducation', label: 'Reeducacao alimentar' },
	{ value: 'weight-maintenance', label: 'Manutencao de peso' },
	{ value: 'sports-performance', label: 'Performance esportiva' },
	{ value: 'metabolic-health', label: 'Saude metabolica' },
	{ value: 'intestinal-health', label: 'Saude intestinal' },
]

const medicalConditionsOptions = [
	{ value: 'diabetes', label: 'Diabetes' },
	{ value: 'hypertension', label: 'Hipertensao' },
	{ value: 'dyslipidemia', label: 'Dislipidemia' },
	{ value: 'heart-disease', label: 'Doenca cardiaca' },
	{ value: 'kidney-disease', label: 'Doenca renal' },
	{ value: 'liver-disease', label: 'Doenca hepatica' },
	{ value: 'thyroid-disorder', label: 'Disturbio de tireoide' },
	{ value: 'food-allergy-intolerance', label: 'Alergias/intolerancias alimentares' },
]

// Fatores de atividade para calculo de GET.
const activityFactorByLevel: Record<string, number> = {
	sedentary: 1.2,
	light: 1.375,
	moderate: 1.55,
	intense: 1.725,
	'very-intense': 1.9,
}

// ---------------------------------------------------------------------------
// Funcoes utilitarias
// ---------------------------------------------------------------------------
function buildApiUrl(path: string) {
	if (!API_BASE_URL) {
		return path
	}

	return `${API_BASE_URL}${path}`
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

// Converte value de input numerico do Mantine para numero valido ou null.
function parseNumericInput(value: NumericInputValue): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value
	}

	if (typeof value === 'string') {
		const normalized = value.trim().replace(',', '.')
		if (!normalized) {
			return null
		}

		const parsed = Number(normalized)
		return Number.isFinite(parsed) ? parsed : null
	}

	return null
}

// Calcula idade em anos completos com base na data de nascimento em ISO UTC.
function calculateAge(birthDateIso: string): number {
	const birthDate = new Date(birthDateIso)
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

// Formula Mifflin-St Jeor para estimar TMB.
function calculateBmr(weight: number, height: number, birthDateIso: string, gender: string): number {
	const age = calculateAge(birthDateIso)
	const base = 10 * weight + 6.25 * height - 5 * age

	if (gender === 'male') {
		return base + 5
	}

	if (gender === 'female') {
		return base - 161
	}

	return base - 78
}

function calculateTdee(bmr: number, activityLevel: string): number {
	const factor = activityFactorByLevel[activityLevel] ?? 1
	return bmr * factor
}

// Formata valores calculados para exibicao em campos readOnly.
function formatCalculatedValue(value: number | null, precision = 1): string {
	if (value === null || !Number.isFinite(value)) {
		return ''
	}

	return value.toFixed(precision)
}

function formatBirthDateInputFromIso(dateValue: string): string {
	const parsedDate = new Date(dateValue)
	if (Number.isNaN(parsedDate.getTime())) {
		return ''
	}

	const day = String(parsedDate.getUTCDate()).padStart(2, '0')
	const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0')
	const year = parsedDate.getUTCFullYear()

	return `${day}/${month}/${year}`
}

function parseGoalValues(goalList: string): string[] {
	return goalList
		.split(',')
		.map((goal) => goal.trim())
		.filter((goal) => goal.length > 0)
}

function toOptionalNumericInputValue(value: number): NumericInputValue {
	if (!Number.isFinite(value) || value <= 0) {
		return ''
	}

	return value
}

function mapPatientDetailsToForm(patient: PatientDetailsResponse): PatientFormState {
	return {
		name: patient.name ?? '',
		birthDate: formatBirthDateInputFromIso(patient.birthDate),
		gender: patient.gender ?? null,
		weight: Number.isFinite(patient.weight) && patient.weight > 0 ? patient.weight : '',
		height: Number.isFinite(patient.height) && patient.height > 0 ? patient.height : '',
		goal: parseGoalValues(patient.goal),
		activityLevel: patient.activityLevel ?? null,
		medicalConditions: Array.isArray(patient.medicalConditions) ? patient.medicalConditions : [],
		armCircumference: toOptionalNumericInputValue(patient.armCircumference),
		waistCircumference: toOptionalNumericInputValue(patient.waistCircumference),
		hipCircumference: toOptionalNumericInputValue(patient.hipCircumference),
		thighCircumference: toOptionalNumericInputValue(patient.thighCircumference),
		subscapularSkinfold: toOptionalNumericInputValue(patient.subscapularSkinfold),
		axillarySkinfold: toOptionalNumericInputValue(patient.axillarySkinfold),
		suprailiacSkinfold: toOptionalNumericInputValue(patient.suprailiacSkinfold),
		abdominalSkinfold: toOptionalNumericInputValue(patient.abdominalSkinfold),
	}
}

export function AddPatientPage() {
	// -----------------------------------------------------------------------
	// Dependencias externas
	// -----------------------------------------------------------------------
	const navigate = useNavigate()
	const { patientId } = useParams<{ patientId: string }>()
	const { token, logout } = useAuth()
	const isEditMode = Boolean(patientId)
	const parsedPatientId = useMemo(() => {
		if (!patientId) {
			return null
		}

		const parsedPatientIdValue = Number(patientId)
		if (!Number.isInteger(parsedPatientIdValue) || parsedPatientIdValue <= 0) {
			return null
		}

		return parsedPatientIdValue
	}, [patientId])

	// -----------------------------------------------------------------------
	// Estado da pagina
	// -----------------------------------------------------------------------
	const [patientForm, setPatientForm] = useState<PatientFormState>(initialPatientForm)
	const [initialFormSnapshot, setInitialFormSnapshot] = useState<PatientFormState>(initialPatientForm)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isLoadingPatient, setIsLoadingPatient] = useState(isEditMode)
	const [loadPatientError, setLoadPatientError] = useState<string | null>(null)
	const [fieldErrors, setFieldErrors] = useState<RequiredFieldErrors>({})

	// -----------------------------------------------------------------------
	// Mapeamento de estilos Mantine
	// -----------------------------------------------------------------------
	const textInputClassNames = {
		root: TextInputStyle.root,
		label: TextInputStyle.label,
		required: TextInputStyle.required,
		input: TextInputStyle.input,
		error: TextInputStyle.error,
		section: TextInputStyle.section,
	}

	const buttonClassNames = {
		root: ButtonStyle.root,
		label: ButtonStyle.label,
	}

	const buttonCancelClassNames = {
		root: ButtonStyle.cancelButton,
		label: ButtonStyle.cancelButtonLabel,
	}

	const notificationClassNames = {
		root: NotificationStyle.root,
		title: NotificationStyle.title,
		description: NotificationStyle.description,
		icon: NotificationStyle.icon,
		closeButton: NotificationStyle.closeButton,
	}

	// -----------------------------------------------------------------------
	// Notificacoes
	// -----------------------------------------------------------------------
	const showSuccessNotification = (message: string, name: string, mode: 'create' | 'update') => {
		notifications.show({
			title: mode === 'update' ? `Paciente ${name} atualizado` : `Paciente ${name} cadastrado`,
			message,
			color: 'green',
			withBorder: true,
			autoClose: 3500,
			className: NotificationStyle.success,
			classNames: notificationClassNames,
			icon: <IoCheckmarkCircleOutline size={20} className={NotificationStyle.successGlyph} />,
		})
	}

	const showErrorNotification = (message: string) => {
		notifications.show({
			title: 'Nao foi possivel salvar',
			message,
			color: 'red',
			withBorder: true,
			autoClose: 4500,
			className: NotificationStyle.error,
			classNames: notificationClassNames,
			icon: <IoAlertCircleOutline size={20} className={NotificationStyle.errorGlyph} />,
		})
	}

	// -----------------------------------------------------------------------
	// Valores derivados (calculados)
	// -----------------------------------------------------------------------
	const birthDateIso = useMemo(() => toPostgresTimestamptz(patientForm.birthDate), [patientForm.birthDate])
	const weightValue = useMemo(() => parseNumericInput(patientForm.weight), [patientForm.weight])
	const heightValue = useMemo(() => parseNumericInput(patientForm.height), [patientForm.height])

	const bmiValue = useMemo(() => {
		if (weightValue === null || heightValue === null || heightValue <= 0) {
			return null
		}

		return weightValue / ((heightValue / 100) ** 2)
	}, [heightValue, weightValue])

	const bmrValue = useMemo(() => {
		if (
			weightValue === null ||
			heightValue === null ||
			heightValue <= 0 ||
			!birthDateIso ||
			!patientForm.gender
		) {
			return null
		}

		return calculateBmr(weightValue, heightValue, birthDateIso, patientForm.gender)
	}, [birthDateIso, heightValue, patientForm.gender, weightValue])

	const tdeeValue = useMemo(() => {
		if (bmrValue === null || !patientForm.activityLevel) {
			return null
		}

		return calculateTdee(bmrValue, patientForm.activityLevel)
	}, [bmrValue, patientForm.activityLevel])

	useEffect(() => {
		if (!isEditMode) {
			setLoadPatientError(null)
			setIsLoadingPatient(false)
			setInitialFormSnapshot(initialPatientForm)
			setPatientForm(initialPatientForm)
			setFieldErrors({})
			return
		}

		if (!token) {
			setIsLoadingPatient(false)
			return
		}

		if (parsedPatientId === null) {
			setIsLoadingPatient(false)
			setLoadPatientError('ID de paciente invalido para edicao.')
			return
		}

		const controller = new AbortController()
		const loadPatientForEdit = async () => {
			try {
				setIsLoadingPatient(true)
				setLoadPatientError(null)

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
					throw new Error('Paciente nao encontrado para edicao.')
				}

				if (!response.ok) {
					const errorMessage = await extractErrorMessage(response, LOAD_PATIENT_ERROR_MESSAGE)
					throw new Error(errorMessage)
				}

				const patientDetails = (await response.json()) as PatientDetailsResponse
				if (controller.signal.aborted) {
					return
				}

				const mappedForm = mapPatientDetailsToForm(patientDetails)
				setPatientForm(mappedForm)
				setInitialFormSnapshot(mappedForm)
				setFieldErrors({})
			} catch (error) {
				if (controller.signal.aborted) {
					return
				}

				const message = error instanceof Error ? error.message : LOAD_PATIENT_ERROR_MESSAGE
				setLoadPatientError(message)
			} finally {
				if (!controller.signal.aborted) {
					setIsLoadingPatient(false)
				}
			}
		}

		void loadPatientForEdit()

		return () => {
			controller.abort()
		}
	}, [isEditMode, parsedPatientId, token, logout])

	// -----------------------------------------------------------------------
	// Helpers de erro por campo
	// -----------------------------------------------------------------------
	const clearFieldErrors = (...fields: RequiredFieldKey[]) => {
		if (fields.length === 0) {
			return
		}

		setFieldErrors((previousErrors) => {
			const nextErrors = { ...previousErrors }
			fields.forEach((field) => {
				delete nextErrors[field]
			})
			return nextErrors
		})
	}

	// -----------------------------------------------------------------------
	// Handlers de formulario
	// -----------------------------------------------------------------------
	const handleTextFieldChange = (field: 'name', value: string) => {
		setPatientForm((previousState) => ({
			...previousState,
			[field]: value,
		}))
		clearFieldErrors('name')
	}

	const handleBirthDateChange = (value: string) => {
		setPatientForm((previousState) => ({
			...previousState,
			birthDate: maskBirthDateInput(value),
		}))
		clearFieldErrors('birthDate', 'bmr', 'tdee')
	}

	const handleNumericFieldChange = (field: NumericFieldKey, value: NumericInputValue) => {
		setPatientForm((previousState) => ({
			...previousState,
			[field]: value,
		}))

		if (field === 'weight') {
			clearFieldErrors('weight', 'bmi', 'bmr', 'tdee')
			return
		}

		if (field === 'height') {
			clearFieldErrors('height', 'bmi', 'bmr', 'tdee')
		}
	}

	const handleGoalsChange = (value: string[]) => {
		setPatientForm((previousState) => ({
			...previousState,
			goal: value,
		}))
		clearFieldErrors('goal')
	}

	const handleGenderChange = (value: string | null) => {
		setPatientForm((previousState) => ({ ...previousState, gender: value }))
		clearFieldErrors('gender', 'bmr', 'tdee')
	}

	const handleActivityLevelChange = (value: string | null) => {
		setPatientForm((previousState) => ({ ...previousState, activityLevel: value }))
		clearFieldErrors('activityLevel', 'tdee')
	}

	const handleMedicalConditionsChange = (value: string[]) => {
		setPatientForm((previousState) => ({
			...previousState,
			medicalConditions: value,
		}))
	}

	const handleReset = () => {
		setPatientForm(initialFormSnapshot)
		setFieldErrors({})
	}

	// -----------------------------------------------------------------------
	// Envio do formulario
	// -----------------------------------------------------------------------
	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (!token) {
			logout()
			return
		}

		if (isEditMode && parsedPatientId === null) {
			showErrorNotification('ID de paciente invalido para edicao.')
			return
		}

		const normalizedName = patientForm.name.trim()
		const validationErrors: RequiredFieldErrors = {}

		if (!normalizedName) {
			validationErrors.name = 'Informe o nome completo.'
		}

		if (!birthDateIso) {
			validationErrors.birthDate = INVALID_BIRTH_DATE_MESSAGE
		}

		if (!patientForm.gender) {
			validationErrors.gender = 'Selecione o sexo.'
		}

		if (weightValue === null || weightValue <= 0) {
			validationErrors.weight = 'Informe um peso valido.'
		}

		if (heightValue === null || heightValue <= 0) {
			validationErrors.height = 'Informe uma altura valida.'
		}

		if (patientForm.goal.length === 0) {
			validationErrors.goal = 'Selecione ao menos um objetivo.'
		}

		if (!patientForm.activityLevel) {
			validationErrors.activityLevel = 'Selecione o nivel de atividade.'
		}

		if (bmiValue === null) {
			validationErrors.bmi = 'IMC nao calculado. Revise peso e altura.'
		}

		// Campos opcionais: quando vazios permanecem null no payload.
		const armCircumference = parseNumericInput(patientForm.armCircumference)
		const waistCircumference = parseNumericInput(patientForm.waistCircumference)
		const hipCircumference = parseNumericInput(patientForm.hipCircumference)
		const thighCircumference = parseNumericInput(patientForm.thighCircumference)
		const subscapularSkinfold = parseNumericInput(patientForm.subscapularSkinfold)
		const axillarySkinfold = parseNumericInput(patientForm.axillarySkinfold)
		const suprailiacSkinfold = parseNumericInput(patientForm.suprailiacSkinfold)
		const abdominalSkinfold = parseNumericInput(patientForm.abdominalSkinfold)

		if (bmrValue === null) {
			validationErrors.bmr = 'TMB nao calculada. Revise sexo, peso, altura e data.'
		}

		if (tdeeValue === null) {
			validationErrors.tdee = 'GET nao calculado. Selecione o nivel de atividade.'
		}

		if (Object.keys(validationErrors).length > 0) {
			setFieldErrors(validationErrors)
			showErrorNotification(REQUIRED_FIELDS_ERROR_MESSAGE)
			return
		}

		setFieldErrors({})

		const payload: CreatePatientRequest = {
			name: normalizedName,
			birthDate: birthDateIso!,
			gender: patientForm.gender!,
			weight: weightValue!,
			height: heightValue!,
			bmi: Number(bmiValue!.toFixed(2)),
			goal: patientForm.goal,
			activityLevel: patientForm.activityLevel!,
			medicalConditions: patientForm.medicalConditions,
			armCircumference,
			waistCircumference,
			hipCircumference,
			thighCircumference,
			subscapularSkinfold,
			axillarySkinfold,
			suprailiacSkinfold,
			abdominalSkinfold,
			bmr: Number(bmrValue!.toFixed(2)),
			tdee: Number(tdeeValue!.toFixed(2)),
		}

		setIsSubmitting(true)
		try {
			const apiPath = isEditMode ? `/api/patients/${parsedPatientId}` : '/api/patients'
			const response = await fetch(buildApiUrl(apiPath), {
				method: isEditMode ? 'PUT' : 'POST',
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

			if (response.status === 404) {
				if (isEditMode) {
					throw new Error('Paciente nao encontrado para edicao.')
				}

				throw new Error('Endpoint de cadastro de pacientes nao encontrado no backend (/api/patients).')
			}

			if (!response.ok) {
				const fallbackErrorMessage = isEditMode
					? UPDATE_PATIENT_ERROR_MESSAGE
					: CREATE_PATIENT_ERROR_MESSAGE
				const errorMessage = await extractErrorMessage(response, fallbackErrorMessage)
				throw new Error(errorMessage)
			}

			setFieldErrors({})
			if (isEditMode) {
				showSuccessNotification('Paciente atualizado com sucesso.', normalizedName, 'update')
				navigate(`/patients/${parsedPatientId}`)
				return
			}

			setPatientForm(initialPatientForm)
			setInitialFormSnapshot(initialPatientForm)
			showSuccessNotification('Paciente cadastrado com sucesso.', normalizedName, 'create')
		} catch (error) {
			const message = error instanceof Error
				? error.message
				: isEditMode
					? UPDATE_PATIENT_ERROR_MESSAGE
					: CREATE_PATIENT_ERROR_MESSAGE
			showErrorNotification(message)
		} finally {
			setIsSubmitting(false)
		}
	}

	const pageTitle = isEditMode ? 'Editar Paciente' : 'Adicionar Paciente'
	const introLabel = isEditMode ? 'Atualizacao de cadastro' : 'Cadastro inicial'
	const introTitle = isEditMode ? 'Atualize os dados do paciente' : 'Preencha os dados do paciente'
	const submitButtonLabel = isEditMode ? 'Salvar Alteracoes' : 'Salvar Paciente'
	const resetButtonLabel = isEditMode ? 'Restaurar' : 'Limpar'
	const isFormUnavailable = isEditMode && (isLoadingPatient || loadPatientError !== null)
	const formId = 'add-patient-form'

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------
	return (
		<Box className="flex h-screen flex-row max-[768px]:h-dvh max-[768px]:flex-col">
			{/* Navegacao lateral fixa da area autenticada */}
			<SideBar
				title="NutriSaaS"
				items={APP_SIDEBAR_ITEMS}
				footer={null}
				color="--color4"
				defaultCollapsed={true}
			/>

			<Box className="flex min-w-0 flex-1 flex-col overflow-hidden p-0 max-[768px]:w-full">
				{/* Cabecalho da pagina */}
				<Box className="px-3 md:px-6">
					<PageInfo
							title={(
								<SplitText
									text={pageTitle}
									className="text-lg font-semibold leading-none text-white md:text-3xl"
								delay={45}
								duration={0.9}
								ease="power2.out"
								splitType="chars"
								from={{ opacity: 0, y: 14 }}
								to={{ opacity: 1, y: 0 }}
								textAlign="left"
								tag="h2"
							/>
						)}
					/>
				</Box>

				<Box className="min-h-0 flex-1 p-3 md:p-6">
					<PageContentContainer
						className="bg-[hsl(var(--card))]"
						contentClassName="gap-6"
						footer={(
								<Group justify="flex-end" align="center" gap="md">
									<Button
										type="submit"
										form={formId}
										radius="md"
										classNames={buttonClassNames}
										loading={isSubmitting}
										disabled={isFormUnavailable}
									>
										{submitButtonLabel}
									</Button>

								<Button
									type="button"
									radius="md"
										variant="outline"
										classNames={buttonCancelClassNames}
										onClick={handleReset}
										disabled={isSubmitting || isFormUnavailable}
									>
										{resetButtonLabel}
									</Button>
							</Group>
						)}
					>
							<Stack gap="md">
								{/* Bloco introdutorio da funcionalidade */}
								<Box className="rounded-[28px] border border-[#c8e4ef] bg-[linear-gradient(125deg,rgba(39,144,176,0.12)_0%,rgba(148,186,101,0.13)_52%,rgba(255,255,255,0.98)_100%)] p-4 sm:p-5">
									<Box className="max-w-[720px]">
											<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
												{introLabel}
											</Text>
											<Text className="mt-1 text-lg font-semibold text-slate-900 md:text-xl">
												{introTitle}
											</Text>
										</Box>
									</Box>

								{isEditMode && isLoadingPatient ? (
									<Box className="rounded-2xl border border-[#d2e4eb] bg-white p-5">
										<Text className="text-sm font-semibold text-slate-700">
											Carregando dados do paciente...
										</Text>
									</Box>
								) : loadPatientError ? (
									<Box className="rounded-2xl border border-red-200 bg-red-50/80 p-5">
										<Text c="red.7" fw={600}>
											{loadPatientError}
										</Text>
									</Box>
								) : (
									/* Formulario principal de cadastro/edicao */
									<Box
										component="form"
										id={formId}
										onSubmit={handleSubmit}
										className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 md:p-6"
									>
									<Grid gutter="md">
									<Grid.Col span={{ base: 12, md: 8 }}>
										<TextInput
											label="Nome completo"
											placeholder="Digite o nome do paciente"
											value={patientForm.name}
											onChange={(event) => handleTextFieldChange('name', event.currentTarget.value)}
											error={Boolean(fieldErrors.name)}
											withAsterisk
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 4 }}>
										<TextInput
											label="Data de Nascimento"
											placeholder="dd/mm/aaaa"
											value={patientForm.birthDate}
											onChange={(event) => handleBirthDateChange(event.currentTarget.value)}
											error={Boolean(fieldErrors.birthDate)}
											inputMode="numeric"
											maxLength={10}
											withAsterisk
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 4 }}>
										<Select
											label="Sexo"
											placeholder="Selecione"
											data={genderOptions}
											value={patientForm.gender}
											onChange={handleGenderChange}
											error={Boolean(fieldErrors.gender)}
											withAsterisk
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 2 }}>
										<NumberInput
											label="Peso (kg)"
											placeholder="Ex: 72.5"
											value={patientForm.weight}
											onChange={(value) => handleNumericFieldChange('weight', value)}
											error={Boolean(fieldErrors.weight)}
											min={0}
											step={0.1}
											decimalScale={1}
											withAsterisk
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 2 }}>
										<NumberInput
											label="Altura (cm)"
											placeholder="Ex: 175"
											value={patientForm.height}
											onChange={(value) => handleNumericFieldChange('height', value)}
											error={Boolean(fieldErrors.height)}
											min={0}
											step={1}
											withAsterisk
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 4 }}>
										<TextInput
											label="IMC"
											placeholder="IMC calculado automaticamente"
											value={formatCalculatedValue(bmiValue, 1)}
											error={Boolean(fieldErrors.bmi)}
											withAsterisk
											readOnly
											disabled
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 6 }}>
										<MultiSelect
											label="Objetivos"
											placeholder="Selecione um ou mais objetivos"
											data={goalOptions}
											value={patientForm.goal}
											onChange={handleGoalsChange}
											error={Boolean(fieldErrors.goal)}
											searchable
											clearable
											hidePickedOptions
											withAsterisk
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 6 }}>
										<Select
											label="Nivel de atividade"
											placeholder="Selecione"
											data={activityLevelOptions}
											value={patientForm.activityLevel}
											onChange={handleActivityLevelChange}
											error={Boolean(fieldErrors.activityLevel)}
											withAsterisk
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={12}>
										<MultiSelect
											label="Condicoes medicas"
											placeholder="Selecione se houver"
											data={medicalConditionsOptions}
											value={patientForm.medicalConditions}
											onChange={handleMedicalConditionsChange}
											searchable
											clearable
											hidePickedOptions
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									{/* Medidas opcionais */}
									<Grid.Col span={{ base: 12, md: 3 }}>
										<NumberInput
											label="Circ. Braco (cm)"
											placeholder="Ex: 32.5"
											value={patientForm.armCircumference}
											onChange={(value) => handleNumericFieldChange('armCircumference', value)}
											min={0}
											step={0.1}
											decimalScale={1}
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 3 }}>
										<NumberInput
											label="Circ. Cintura (cm)"
											placeholder="Ex: 85.0"
											value={patientForm.waistCircumference}
											onChange={(value) => handleNumericFieldChange('waistCircumference', value)}
											min={0}
											step={0.1}
											decimalScale={1}
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 3 }}>
										<NumberInput
											label="Circ. Quadril (cm)"
											placeholder="Ex: 95.0"
											value={patientForm.hipCircumference}
											onChange={(value) => handleNumericFieldChange('hipCircumference', value)}
											min={0}
											step={0.1}
											decimalScale={1}
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 3 }}>
										<NumberInput
											label="Circ. Coxa (cm)"
											placeholder="Ex: 55.0"
											value={patientForm.thighCircumference}
											onChange={(value) => handleNumericFieldChange('thighCircumference', value)}
											min={0}
											step={0.1}
											decimalScale={1}
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 3 }}>
										<NumberInput
											label="Subescapular (mm)"
											placeholder="Ex: 12.0"
											value={patientForm.subscapularSkinfold}
											onChange={(value) => handleNumericFieldChange('subscapularSkinfold', value)}
											min={0}
											step={0.1}
											decimalScale={1}
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 3 }}>
										<NumberInput
											label="Axilar media (mm)"
											placeholder="Ex: 10.0"
											value={patientForm.axillarySkinfold}
											onChange={(value) => handleNumericFieldChange('axillarySkinfold', value)}
											min={0}
											step={0.1}
											decimalScale={1}
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 3 }}>
										<NumberInput
											label="Suprailiaca (mm)"
											placeholder="Ex: 15.0"
											value={patientForm.suprailiacSkinfold}
											onChange={(value) => handleNumericFieldChange('suprailiacSkinfold', value)}
											min={0}
											step={0.1}
											decimalScale={1}
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 3 }}>
										<NumberInput
											label="Abdominal (mm)"
											placeholder="Ex: 20.0"
											value={patientForm.abdominalSkinfold}
											onChange={(value) => handleNumericFieldChange('abdominalSkinfold', value)}
											min={0}
											step={0.1}
											decimalScale={1}
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 6 }}>
										<TextInput
											label="TMB (kcal)"
											placeholder="Calculada automaticamente"
											value={formatCalculatedValue(bmrValue, 0)}
											error={Boolean(fieldErrors.bmr)}
											withAsterisk
											readOnly
											disabled
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>

									<Grid.Col span={{ base: 12, md: 6 }}>
										<TextInput
											label="GET (kcal)"
											placeholder="Calculado automaticamente"
											value={formatCalculatedValue(tdeeValue, 0)}
											error={Boolean(fieldErrors.tdee)}
											withAsterisk
											readOnly
											disabled
											radius="md"
											classNames={textInputClassNames}
										/>
									</Grid.Col>
									</Grid>
									</Box>
								)}
							</Stack>
						</PageContentContainer>
				</Box>
			</Box>
		</Box>
	)
}
