import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Grid, Group, Skeleton, Stack, Text } from '@mantine/core'
import { useNavigate, useParams } from 'react-router-dom'

import ButtonStyle from '../components/mantine/buttons/PrimaryButton.module.css'
import { SideBar } from '../components/custom/sidebar/SideBar'
import { PageInfo } from '../components/custom/pageInfo/PageInfo'
import { PageContentContainer } from '../components/custom/pageContentContainer/PageContentContainer'

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

type InfoFieldProps = {
	label: string
	value: string
}

type PillMeta = {
	label: string
	className: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
const LOAD_PATIENT_DETAILS_ERROR_MESSAGE = 'Não foi possível carregar os detalhes do paciente.'
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

function buildApiUrl(path: string) {
	if (!API_BASE_URL) {
		return path
	}

	return `${API_BASE_URL}${path}`
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
	const { token, logout } = useAuth()

	const [patient, setPatient] = useState<PatientDetailsResponse | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	const buttonClassNames = {
		root: ButtonStyle.root,
		label: ButtonStyle.label,
	}

	const neutralButtonClassNames = {
		root: ButtonStyle.neutralRoot,
		label: ButtonStyle.neutralLabel,
	}

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
							<Group justify="space-between" className="w-full">
								<Button
									type="button"
									radius="md"
									classNames={buttonClassNames}
									onClick={() => {
										if (parsedPatientId !== null) {
											navigate(`/patients/${parsedPatientId}/menu`)
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
		</Box>
	)
}
