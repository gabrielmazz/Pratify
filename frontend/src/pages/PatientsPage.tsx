import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Group, Skeleton, Table, Text } from '@mantine/core'
import { useNavigate } from 'react-router-dom'

import ButtonStyle from '../components/mantine/buttons/PrimaryButton.module.css'
import { AppModal } from '../components/mantine/modals/AppModal'
import { SideBar } from '../components/custom/sidebar/SideBar'
import { PageInfo } from '../components/custom/pageInfo/PageInfo'
import { PageContentContainer } from '../components/custom/pageContentContainer/PageContentContainer'

import SplitText from '../components/react-bits/SplitText'
import { useAuth } from '../auth/AuthContext'
import { APP_SIDEBAR_ITEMS } from '../lib/sidebarItems'
import { cn } from '../lib/utils'
import {
	MdArrowDropDown,
	MdArrowDropUp,
	MdDeleteOutline,
	MdEdit,
	MdOutlineVisibility,
	MdUnfoldMore,
} from 'react-icons/md'

type PatientListItemResponse = {
	id: number
	name: string
	birthDate: string
	gender: string
	bmi: number
	goal: string
	activityLevel: string
	createdAt: string
}

type PillMeta = {
	label: string
	className: string
}

type SortKey =
	| 'name'
	| 'birthDate'
	| 'gender'
	| 'goal'
	| 'activityLevel'
	| 'bmi'
	| 'createdAt'

type SortDirection = 'asc' | 'desc'

type SortState = {
	key: SortKey
	direction: SortDirection
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
const LOAD_PATIENTS_ERROR_MESSAGE = 'Nao foi possivel carregar os pacientes.'
const DELETE_PATIENT_ERROR_MESSAGE = 'Nao foi possivel excluir o paciente.'
const GOAL_LABELS: Record<string, string> = {
	'weight-loss': 'Emagrecimento',
	'muscle-gain': 'Ganho muscular',
	'dietary-reeducation': 'Reeducacao alimentar',
	'weight-maintenance': 'Manutencao de peso',
	'sports-performance': 'Performance esportiva',
	'metabolic-health': 'Saude metabolica',
	'intestinal-health': 'Saude intestinal',
}
const DEFAULT_PILL_CLASS =
	'border border-slate-200 bg-slate-100 text-slate-700'
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
		label: 'Sedentario',
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

async function extractErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
	try {
		const errorPayload = (await response.json()) as { message?: string }
		if (errorPayload.message?.trim()) {
			return errorPayload.message
		}
	} catch {
		// Mantem a mensagem padrao caso o backend nao retorne JSON.
	}

	return fallbackMessage
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

function getBmiMeta(bmi: number): PillMeta {
	if (bmi < 18.5) {
		return {
			label: 'Abaixo',
			className: 'border border-amber-200 bg-amber-50 text-amber-700',
		}
	}

	if (bmi < 25) {
		return {
			label: 'Saudavel',
			className: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
		}
	}

	if (bmi < 30) {
		return {
			label: 'Elevado',
			className: 'border border-orange-200 bg-orange-50 text-orange-700',
		}
	}

	return {
		label: 'Alto risco',
		className: 'border border-rose-200 bg-rose-50 text-rose-700',
	}
}

function formatLastUpdatedAt(lastUpdatedAt: Date | null) {
	if (!lastUpdatedAt) {
		return 'Use "Atualizar" para buscar os dados mais recentes.'
	}

	return `Ultima atualizacao em ${lastUpdatedAt.toLocaleDateString('pt-BR')} as ${lastUpdatedAt.toLocaleTimeString('pt-BR', {
		hour: '2-digit',
		minute: '2-digit',
	})}`
}

function toTimestamp(value: string) {
	const parsedDate = new Date(value)
	if (Number.isNaN(parsedDate.getTime())) {
		return 0
	}

	return parsedDate.getTime()
}

function comparePatientValues(left: PatientListItemResponse, right: PatientListItemResponse, key: SortKey) {
	const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

	if (key === 'name') {
		return collator.compare(left.name, right.name)
	}

	if (key === 'birthDate') {
		return toTimestamp(left.birthDate) - toTimestamp(right.birthDate)
	}

	if (key === 'gender') {
		return collator.compare(formatGender(left.gender), formatGender(right.gender))
	}

	if (key === 'goal') {
		const leftGoals = parseGoalTags(left.goal).join(', ')
		const rightGoals = parseGoalTags(right.goal).join(', ')
		return collator.compare(leftGoals, rightGoals)
	}

	if (key === 'activityLevel') {
		return collator.compare(formatActivityLevel(left.activityLevel), formatActivityLevel(right.activityLevel))
	}

	if (key === 'bmi') {
		return left.bmi - right.bmi
	}

	return toTimestamp(left.createdAt) - toTimestamp(right.createdAt)
}

function getAriaSortValue(key: SortKey, sortState: SortState | null) {
	if (!sortState || sortState.key !== key) {
		return 'none'
	}

	return sortState.direction === 'asc' ? 'ascending' : 'descending'
}

function getSortIcon(key: SortKey, sortState: SortState | null) {
	if (!sortState || sortState.key !== key) {
		return <MdUnfoldMore aria-hidden size={16} className="text-slate-400" />
	}

	if (sortState.direction === 'asc') {
		return <MdArrowDropUp aria-hidden size={18} className="text-slate-700" />
	}

	return <MdArrowDropDown aria-hidden size={18} className="text-slate-700" />
}

export function PatientsPage() {
	const navigate = useNavigate()
	const { token, logout } = useAuth()
	const [patients, setPatients] = useState<PatientListItemResponse[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
	const [sortState, setSortState] = useState<SortState | null>(null)
	const [patientToEdit, setPatientToEdit] = useState<PatientListItemResponse | null>(null)
	const [patientToDelete, setPatientToDelete] = useState<PatientListItemResponse | null>(null)
	const [isDeletingPatient, setIsDeletingPatient] = useState(false)

	const buttonClassNames = {
		root: ButtonStyle.root,
		label: ButtonStyle.label,
	}
	const neutralButtonClassNames = {
		root: ButtonStyle.neutralRoot,
		label: ButtonStyle.neutralLabel,
	}
	const modalActionButtonSizeClassName = 'w-[128px]'

	const hasPatients = patients.length > 0
	const sortedPatients = useMemo(() => {
		if (!sortState) {
			return patients
		}

		const orderedPatients = [...patients].sort((leftPatient, rightPatient) => {
			const comparison = comparePatientValues(leftPatient, rightPatient, sortState.key)
			if (comparison !== 0) {
				return sortState.direction === 'asc' ? comparison : -comparison
			}

			return leftPatient.id - rightPatient.id
		})

		return orderedPatients
	}, [patients, sortState])

	const handleSortByColumn = (key: SortKey) => {
		setSortState((currentSortState) => {
			if (!currentSortState || currentSortState.key !== key) {
				return {
					key,
					direction: 'asc',
				}
			}

			return {
				key,
				direction: currentSortState.direction === 'asc' ? 'desc' : 'asc',
			}
		})
	}

	const closeEditModal = () => {
		setPatientToEdit(null)
	}

	const closeDeleteModal = () => {
		if (isDeletingPatient) {
			return
		}

		setPatientToDelete(null)
	}

	const handleConfirmEdit = () => {
		if (!patientToEdit) {
			return
		}

		navigate(`/patients/${patientToEdit.id}/edit`)
		closeEditModal()
	}

	const handleConfirmDelete = async () => {
		if (!token || !patientToDelete || isDeletingPatient) {
			return
		}

		try {
			setIsDeletingPatient(true)
			setErrorMessage(null)

			const response = await fetch(buildApiUrl(`/api/patients/${patientToDelete.id}`), {
				method: 'DELETE',
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
				const message = await extractErrorMessage(response, DELETE_PATIENT_ERROR_MESSAGE)
				throw new Error(message)
			}

			setPatients((currentPatients) =>
				currentPatients.filter((currentPatient) => currentPatient.id !== patientToDelete.id),
			)
			setLastUpdatedAt(new Date())
			setPatientToDelete(null)
		} catch (error) {
			const message = error instanceof Error ? error.message : DELETE_PATIENT_ERROR_MESSAGE
			setErrorMessage(message)
		} finally {
			setIsDeletingPatient(false)
		}
	}

	const loadPatients = async (signal?: AbortSignal) => {
		if (!token) {
			setPatients([])
			setIsLoading(false)
			setLastUpdatedAt(null)
			return
		}

		try {
			setIsLoading(true)
			setErrorMessage(null)

			const response = await fetch(buildApiUrl('/api/patients'), {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/json',
				},
				signal,
			})

			if (response.status === 401) {
				logout()
				return
			}

			if (!response.ok) {
				throw new Error(LOAD_PATIENTS_ERROR_MESSAGE)
			}

			const data = (await response.json()) as PatientListItemResponse[]
			if (!signal?.aborted) {
				setPatients(data)
				setLastUpdatedAt(new Date())
			}
		} catch (error) {
			if (signal?.aborted) {
				return
			}

			const message = error instanceof Error ? error.message : LOAD_PATIENTS_ERROR_MESSAGE
			setErrorMessage(message)
		} finally {
			if (!signal?.aborted) {
				setIsLoading(false)
			}
		}
	}

	useEffect(() => {
		const controller = new AbortController()
		void loadPatients(controller.signal)

		return () => {
			controller.abort()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token, logout])

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
							<SplitText
								text="Pacientes"
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
						contentClassName="gap-5 overflow-hidden"
					>
						<Box className="rounded-[28px] border border-[#c8e4ef] bg-[linear-gradient(125deg,rgba(39,144,176,0.12)_0%,rgba(148,186,101,0.13)_52%,rgba(255,255,255,0.98)_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:p-5">
							<Group justify="space-between" align="flex-start" gap="md">
								<Box className="max-w-[720px]">
									<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
										Listagem de pacientes
									</Text>
										<Text className="mt-1 text-lg font-semibold text-slate-900 md:text-xl">
											Visao geral dos pacientes
										</Text>
										<Text className="mt-2 text-xs font-medium text-slate-600">
											{formatLastUpdatedAt(lastUpdatedAt)}
										</Text>
									</Box>	
								</Group>
							</Box>

						{isLoading ? (
							<Box className="rounded-3xl border border-[hsl(var(--border))] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-4">
								<Box className="grid grid-cols-8 gap-3 rounded-xl border border-[#d2e4eb] bg-[#edf5f8] p-3">
									{Array.from({ length: 8 }).map((_, index) => (
										<Skeleton key={`patients-table-header-${index}`} height={12} radius="sm" />
									))}
								</Box>

								<Box className="mt-3 space-y-2">
									{Array.from({ length: 7 }).map((_, rowIndex) => (
										<Box
											key={`patients-table-row-${rowIndex}`}
											className="grid grid-cols-8 gap-3 rounded-xl border border-slate-100 bg-white p-3"
										>
											<Skeleton height={16} radius="sm" />
											<Skeleton height={16} radius="sm" />
											<Skeleton height={22} radius="xl" />
											<Skeleton height={16} radius="sm" />
											<Skeleton height={22} radius="xl" />
											<Skeleton height={16} radius="sm" />
											<Skeleton height={16} radius="sm" />
											<Skeleton height={24} radius="md" />
										</Box>
									))}
								</Box>
							</Box>
						) : errorMessage ? (
							<Box className="rounded-3xl border border-red-200 bg-red-50/80 p-5">
								<Text c="red.7" fw={600}>
									{errorMessage}
								</Text>
							</Box>
						) : !hasPatients ? (
							<Box className="rounded-3xl border border-[hsl(var(--border))] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-5 shadow-[0_10px_26px_rgba(17,24,39,0.06)]">
								<Text className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
									Nenhum paciente cadastrado ainda.
								</Text>
							</Box>
						) : (
							<Box className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)]">
								<Box className="patients-table-scroll min-h-0 flex-1 overflow-auto">
									<Table
										verticalSpacing="sm"
										horizontalSpacing="sm"
										className="min-w-[1020px]"
									>
										<Table.Thead>
											<Table.Tr>
												<Table.Th
													aria-sort={getAriaSortValue('name', sortState)}
													className="sticky top-0 z-10 border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600"
												>
													<button
														type="button"
														onClick={() => handleSortByColumn('name')}
														className={cn(
															'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:text-slate-900',
															sortState?.key === 'name' && 'text-slate-900',
														)}
													>
														<span>Nome</span>
														<span className="inline-flex h-4 w-4 items-center justify-center">
															{getSortIcon('name', sortState)}
														</span>
													</button>
												</Table.Th>
												<Table.Th
													aria-sort={getAriaSortValue('birthDate', sortState)}
													className="sticky top-0 z-10 border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600"
												>
													<button
														type="button"
														onClick={() => handleSortByColumn('birthDate')}
														className={cn(
															'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:text-slate-900',
															sortState?.key === 'birthDate' && 'text-slate-900',
														)}
													>
														<span>Nascimento</span>
														<span className="inline-flex h-4 w-4 items-center justify-center">
															{getSortIcon('birthDate', sortState)}
														</span>
													</button>
												</Table.Th>
												<Table.Th
													aria-sort={getAriaSortValue('gender', sortState)}
													className="sticky top-0 z-10 border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600"
												>
													<button
														type="button"
														onClick={() => handleSortByColumn('gender')}
														className={cn(
															'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:text-slate-900',
															sortState?.key === 'gender' && 'text-slate-900',
														)}
													>
														<span>Sexo</span>
														<span className="inline-flex h-4 w-4 items-center justify-center">
															{getSortIcon('gender', sortState)}
														</span>
													</button>
												</Table.Th>
												<Table.Th
													aria-sort={getAriaSortValue('goal', sortState)}
													className="sticky top-0 z-10 border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600"
												>
													<button
														type="button"
														onClick={() => handleSortByColumn('goal')}
														className={cn(
															'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:text-slate-900',
															sortState?.key === 'goal' && 'text-slate-900',
														)}
													>
														<span>Objetivos</span>
														<span className="inline-flex h-4 w-4 items-center justify-center">
															{getSortIcon('goal', sortState)}
														</span>
													</button>
												</Table.Th>
												<Table.Th
													aria-sort={getAriaSortValue('activityLevel', sortState)}
													className="sticky top-0 z-10 border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600"
												>
													<button
														type="button"
														onClick={() => handleSortByColumn('activityLevel')}
														className={cn(
															'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:text-slate-900',
															sortState?.key === 'activityLevel' && 'text-slate-900',
														)}
													>
														<span>Atividade</span>
														<span className="inline-flex h-4 w-4 items-center justify-center">
															{getSortIcon('activityLevel', sortState)}
														</span>
													</button>
												</Table.Th>
												<Table.Th
													aria-sort={getAriaSortValue('bmi', sortState)}
													className="sticky top-0 z-10 border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600"
												>
													<button
														type="button"
														onClick={() => handleSortByColumn('bmi')}
														className={cn(
															'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:text-slate-900',
															sortState?.key === 'bmi' && 'text-slate-900',
														)}
													>
														<span>IMC</span>
														<span className="inline-flex h-4 w-4 items-center justify-center">
															{getSortIcon('bmi', sortState)}
														</span>
													</button>
												</Table.Th>
												<Table.Th
													aria-sort={getAriaSortValue('createdAt', sortState)}
													className="sticky top-0 z-10 border-b border-[#d2e4eb] bg-[#edf5f8] text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600"
												>
													<button
														type="button"
														onClick={() => handleSortByColumn('createdAt')}
														className={cn(
															'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:text-slate-900',
															sortState?.key === 'createdAt' && 'text-slate-900',
														)}
													>
														<span>Criado em</span>
														<span className="inline-flex h-4 w-4 items-center justify-center">
															{getSortIcon('createdAt', sortState)}
														</span>
													</button>
												</Table.Th>
												<Table.Th className="sticky top-0 z-10 w-[1%] whitespace-nowrap border-b border-[#d2e4eb] bg-[#edf5f8] text-center text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
													Acoes
												</Table.Th>
											</Table.Tr>
										</Table.Thead>

										<Table.Tbody>
											{sortedPatients.map((patient) => {
												const genderMeta = getGenderMeta(patient.gender)
												const activityMeta = getActivityMeta(patient.activityLevel)
												const bmiMeta = getBmiMeta(patient.bmi)
												const goals = parseGoalTags(patient.goal)
												const avatarLabel = patient.name.trim().charAt(0).toUpperCase() || '?'

												return (
													<Table.Tr
														key={patient.id}
														className="border-b border-slate-100 transition-colors hover:bg-[#f4fafc]"
													>
														<Table.Td>
															<Group gap="sm" wrap="nowrap">
																<Box className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color4)_0%,var(--color5)_100%)] text-sm font-semibold text-white shadow-[0_8px_14px_rgba(39,144,176,0.35)]">
																	{avatarLabel}
																</Box>

																<Box className="min-w-0">
																	<Text className="truncate text-sm font-semibold text-slate-900">
																		{patient.name}
																	</Text>
																	<Text className="text-xs text-slate-500">
																		ID #{patient.id}
																	</Text>
																</Box>
															</Group>
														</Table.Td>

														<Table.Td className="text-sm font-medium text-slate-700">
															{formatDate(patient.birthDate)}
														</Table.Td>

														<Table.Td>
															<Box
																component="span"
																className={cn(
																	'inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-semibold',
																	genderMeta.className,
																)}
															>
																{genderMeta.label}
															</Box>
														</Table.Td>

														<Table.Td className="max-w-[360px]">
															{goals.length > 0 ? (
																<Box className="flex flex-wrap gap-1.5">
																	{goals.slice(0, 3).map((goalTag, index) => (
																		<Box
																			key={`${patient.id}-${goalTag}-${index}`}
																			component="span"
																			className="inline-flex items-center rounded-full border border-[#c6dbe3] bg-[#eaf3f7] px-2.5 py-1 text-[0.68rem] font-semibold text-slate-700"
																		>
																			{goalTag}
																		</Box>
																	))}

																	{goals.length > 3 ? (
																		<Box
																			component="span"
																			className="inline-flex items-center rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-slate-600"
																		>
																			+{goals.length - 3}
																		</Box>
																	) : null}
																</Box>
															) : (
																<Text className="text-sm text-slate-400">-</Text>
															)}
														</Table.Td>

														<Table.Td>
															<Box
																component="span"
																className={cn(
																	'inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-semibold',
																	activityMeta.className,
																)}
															>
																{activityMeta.label}
															</Box>
														</Table.Td>

														<Table.Td>
															<Box className="flex items-center gap-2">
																<Text className="text-sm font-semibold text-slate-900">
																	{patient.bmi.toFixed(1)}
																</Text>
																<Box
																	component="span"
																	className={cn(
																		'inline-flex items-center rounded-full px-2 py-1 text-[0.64rem] font-semibold',
																		bmiMeta.className,
																	)}
																>
																	{bmiMeta.label}
																</Box>
															</Box>
														</Table.Td>

														<Table.Td className="text-sm font-medium text-slate-700">
															{formatDate(patient.createdAt)}
														</Table.Td>

														<Table.Td className="w-[1%] whitespace-nowrap py-2">
															<Group gap={4} wrap="nowrap">
																<button
																	type="button"
																	onClick={() => navigate(`/patients/${patient.id}`)}
																	aria-label={`Visualizar paciente ${patient.name}`}
																	className="inline-flex h-7 items-center gap-1 rounded-md border border-[#b7d4df] bg-white px-2 py-1 text-[0.62rem] font-semibold uppercase leading-none tracking-[0.04em] text-[#2b5f70] transition-colors hover:bg-[#eef7fb]"
																>
																	<MdOutlineVisibility aria-hidden size={12} />
																	Ver
																</button>

																<button
																	type="button"
																	onClick={() => setPatientToEdit(patient)}
																	aria-label={`Editar paciente ${patient.name}`}
																	className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[0.62rem] font-semibold uppercase leading-none tracking-[0.04em] text-amber-700 transition-colors hover:bg-amber-50"
																>
																	<MdEdit aria-hidden size={12} />
																	Editar
																</button>

																<button
																	type="button"
																	onClick={() => setPatientToDelete(patient)}
																	aria-label={`Excluir paciente ${patient.name}`}
																	disabled={isDeletingPatient}
																	className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-[0.62rem] font-semibold uppercase leading-none tracking-[0.04em] text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
																>
																	<MdDeleteOutline aria-hidden size={12} />
																	Excluir
																</button>
															</Group>
														</Table.Td>
													</Table.Tr>
												)
											})}
										</Table.Tbody>
									</Table>
								</Box>
							</Box>
						)}
					</PageContentContainer>
				</Box>
			</Box>

			<AppModal
				opened={patientToEdit !== null}
				onClose={closeEditModal}
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
								Deseja realmente editar os dados de{' '}
								<Text component="span" className="font-semibold text-slate-900">
									{patientToEdit?.name}
								</Text>
								?
							</Text>
						</Box>
					</Group>

					<Group justify="flex-end" gap="sm" mt="xl" className="border-t border-[#e4edf1] pt-4">
						<Button
							onClick={closeEditModal}
							classNames={neutralButtonClassNames}
							className={modalActionButtonSizeClassName}
						>
							Cancelar
						</Button>
						<Button
							classNames={buttonClassNames}
							onClick={handleConfirmEdit}
							className={modalActionButtonSizeClassName}
						>
							Sim, editar
						</Button>
					</Group>
				</Box>
			</AppModal>

			<AppModal
				opened={patientToDelete !== null}
				onClose={closeDeleteModal}
				title="Confirmar exclusão"
				centered
				size="30%"
				closeOnClickOutside={!isDeletingPatient}
				closeOnEscape={!isDeletingPatient}
				withCloseButton={!isDeletingPatient}
				overlayProps={{ blur: 2, backgroundOpacity: 0.45 }}
			>
				<Box className="px-5 pb-5 pt-4">
					<Group align="flex-start" wrap="nowrap" gap="sm" className="flex items-center">
						<Box className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700">
							<MdDeleteOutline aria-hidden size={18} />
						</Box>

						<Box className="min-w-0">
							<Text className="mt-1 text-sm leading-relaxed text-slate-700">
								Deseja realmente excluir{' '}
								<Text component="span" className="font-semibold text-slate-900">
									{patientToDelete?.name}
								</Text>{' '}
								da listagem?
							</Text>
						</Box>
					</Group>

					<Group justify="flex-end" gap="sm" mt="xl" className="border-t border-[#e4edf1] pt-4">
						<Button
							onClick={closeDeleteModal}
							disabled={isDeletingPatient}
							classNames={neutralButtonClassNames}
							className={modalActionButtonSizeClassName}
						>
							Cancelar
						</Button>
						<Button
							onClick={handleConfirmDelete}
							loading={isDeletingPatient}
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
