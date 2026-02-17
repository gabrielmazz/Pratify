import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Grid, Text, Divider, Image, TextInput, Group, Button, FileInput, Skeleton, Stack } from '@mantine/core'
import { BarChart, DonutChart, LineChart } from '@mantine/charts'

import TextInputStyle from '../components/mantine/inputs/TextInput.module.css'
import ButtonStyle from '../components/mantine/buttons/PrimaryButton.module.css'

import { SideBar } from '../components/custom/sidebar/SideBar'
import { PageInfo } from '../components/custom/pageInfo/PageInfo'
import { PageContentContainer } from '../components/custom/pageContentContainer/PageContentContainer'

import SplitText from '../components/react-bits/SplitText'
import { useAuth } from '../auth/AuthContext'
import { formatBirthDateForInput, getAgeFromMaskedBirthDate, maskBirthDateInput, toPostgresTimestamptz } from '../functions/date'
import { APP_SIDEBAR_ITEMS } from '../lib/sidebarItems'

// ---------------------------------------------------------------------------
// Tipos de dados
// ---------------------------------------------------------------------------
// Resposta vinda do endpoint GET /api/users/me.
type CurrentUserResponse = {
	id: number
	name: string
	email: string
	createdAt: string
	birthDate: string | null
	specialty: string | null
	phone: string | null
	crn: string | null
	institution: string | null
	profilePicture: string | null
	isVerified: boolean
	city: string | null
	state: string | null
}

// Payload enviado para o endpoint POST /api/users/me.
type UpdateCurrentUserRequest = {
	birthDate: string | null
	institution: string | null
	crn: string | null
	city: string | null
	state: string | null
}

// Estado local usado pelo formulario de edicao no frontend.
type ProfileFormState = {
	birthDate: string
	institution: string
	crn: string
	city: string
	state: string
}

type DashboardPatientListItemResponse = {
	id: number
	name: string
	birthDate: string
	gender: string
	bmi: number
	goal: string
	activityLevel: string
	createdAt: string
}

// ---------------------------------------------------------------------------
// Configuracao da pagina
// ---------------------------------------------------------------------------
// URL base da API (com fallback para chamadas relativas em ambiente local).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
// Imagem usada quando o usuario nao possui foto de perfil.
const FALLBACK_PROFILE_IMAGE_URL = 'https://thumbs.dreamstime.com/b/test-icon-vector-question-mark-male-user-person-profile-avatar-symbol-help-sign-glyph-pictogram-test-icon-vector-168495430.jpg'
// Mensagens padrao de erro para manter o texto consistente na tela.
const LOAD_USER_ERROR_MESSAGE = 'Nao foi possivel carregar os dados do usuario.'
const LOAD_PATIENTS_ERROR_MESSAGE = 'Nao foi possivel carregar os dados dos pacientes.'
const SAVE_USER_ERROR_MESSAGE = 'Nao foi possivel salvar as alteracoes do perfil.'
const INVALID_BIRTH_DATE_MESSAGE = 'Informe uma data valida no formato dd/mm/aaaa.'
const ACTIVITY_LEVEL_LABELS: Record<string, string> = {
	sedentary: 'Sedentario',
	light: 'Leve',
	moderate: 'Moderado',
	intense: 'Intenso',
	'very-intense': 'Muito intenso',
}
const ACTIVITY_LEVEL_ORDER = ['sedentary', 'light', 'moderate', 'intense', 'very-intense']
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ---------------------------------------------------------------------------
// Mapeamento de estilos dos componentes Mantine
// ---------------------------------------------------------------------------
const textInputClassNames = {
	root: TextInputStyle.root,
	label: TextInputStyle.label,
	required: TextInputStyle.required,
	input: TextInputStyle.input,
	section: TextInputStyle.section,
}

const editButtonClassNames = {
	root: ButtonStyle.root,
	label: ButtonStyle.label,
}

const cancelButtonClassNames = {
	root: ButtonStyle.cancelButton,
	label: ButtonStyle.cancelButtonLabel,
}

const confirmButtonClassNames = {
	root: ButtonStyle.confirmButton,
	label: ButtonStyle.confirmButtonLabel,
}

// Monta URL completa para chamadas da API.
function buildApiUrl(path: string) {
	if (!API_BASE_URL) {
		return path
	}

	return `${API_BASE_URL}${path}`
}

// Converte string vazia em null para campos opcionais no backend.
function normalizeOptionalText(value: string): string | null {
	const normalized = value.trim()
	return normalized.length > 0 ? normalized : null
}

// Centraliza a criacao do estado inicial/atual do formulario a partir do usuario.
function getInitialProfileFormState(user: CurrentUserResponse | null): ProfileFormState {
	return {
		birthDate: formatBirthDateForInput(user?.birthDate),
		institution: user?.institution ?? '',
		crn: user?.crn ?? '',
		city: user?.city ?? '',
		state: user?.state ?? '',
	}
}

// Extrai mensagem de erro retornada pela API; se nao houver, usa fallback.
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

function calculateAgeFromIsoDate(dateValue: string): number | null {
	const parsedDate = new Date(dateValue)
	if (Number.isNaN(parsedDate.getTime())) {
		return null
	}

	const now = new Date()
	let age = now.getUTCFullYear() - parsedDate.getUTCFullYear()
	const hasNotHadBirthdayYet =
		now.getUTCMonth() < parsedDate.getUTCMonth() ||
		(now.getUTCMonth() === parsedDate.getUTCMonth() && now.getUTCDate() < parsedDate.getUTCDate())

	if (hasNotHadBirthdayYet) {
		age -= 1
	}

	return age >= 0 ? age : null
}

function formatPercent(value: number, total: number) {
	if (total <= 0) {
		return '0%'
	}

	return `${Math.round((value / total) * 100)}%`
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

	// Compatibilidade com possiveis paths relativos salvos em bases legadas.
	if (normalized.startsWith('/')) {
		return buildApiUrl(normalized)
	}

	return normalized
}

export function DashboardPage() {
	// -----------------------------------------------------------------------
	// Dependencias externas
	// -----------------------------------------------------------------------
	const { token, logout } = useAuth()

	// -----------------------------------------------------------------------
	// Estado da pagina
	// -----------------------------------------------------------------------
	// Dados carregados da API.
	const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(null)
	// Estado editavel do formulario.
	const [profileForm, setProfileForm] = useState<ProfileFormState>(() => getInitialProfileFormState(null))
	// Flags de controle de UI.
	const [isEditing, setIsEditing] = useState(false)
	const [isSavingProfile, setIsSavingProfile] = useState(false)
	// Mensagens de erro da tentativa de salvar.
	const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
	const [selectedProfilePicture, setSelectedProfilePicture] = useState<File | null>(null)
	const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<string | null>(null)
	const [resolvedProfileImageSrc, setResolvedProfileImageSrc] = useState(FALLBACK_PROFILE_IMAGE_URL)
	const [isProfileImageLoading, setIsProfileImageLoading] = useState(true)
	// Estados reservados para fluxo de carregamento inicial.
	const [isLoadingUser, setIsLoadingUser] = useState(true)
	const [, setUserError] = useState<string | null>(null)
	// Estado do mini relatorio de pacientes.
	const [patients, setPatients] = useState<DashboardPatientListItemResponse[]>([])
	const [isLoadingPatients, setIsLoadingPatients] = useState(false)
	const [patientsErrorMessage, setPatientsErrorMessage] = useState<string | null>(null)

	// -----------------------------------------------------------------------
	// Efeitos: carregamento inicial do perfil
	// -----------------------------------------------------------------------
	useEffect(() => {
		if (!token) {
			setCurrentUser(null)
			setProfileForm(getInitialProfileFormState(null))
			setIsLoadingUser(false)
			return
		}

		const controller = new AbortController()

		const loadCurrentUser = async () => {
			try {
				setUserError(null)
				setIsLoadingUser(true)

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
					throw new Error(LOAD_USER_ERROR_MESSAGE)
				}

				const user = (await response.json()) as CurrentUserResponse
				if (controller.signal.aborted) {
					return
				}

				setCurrentUser(user)
				setProfileForm(getInitialProfileFormState(user))
			} catch (error) {
				if (controller.signal.aborted) {
					return
				}

				const message = error instanceof Error ? error.message : LOAD_USER_ERROR_MESSAGE
				setUserError(message)
			} finally {
				if (!controller.signal.aborted) {
					setIsLoadingUser(false)
				}
			}
		}

		void loadCurrentUser()

		return () => {
			controller.abort()
		}
	}, [logout, token])

	// -----------------------------------------------------------------------
	// Efeitos: sincroniza formulario quando os dados do usuario mudam
	// -----------------------------------------------------------------------
	// Evita sobrescrever digitacao do usuario enquanto ele estiver editando.
	useEffect(() => {
		if (isEditing) {
			return
		}

		setProfileForm(getInitialProfileFormState(currentUser))
	}, [currentUser, isEditing])

	const loadPatientsReport = useCallback(async (signal?: AbortSignal) => {
		if (!token) {
			setPatients([])
			setIsLoadingPatients(false)
			setPatientsErrorMessage(null)
			return
		}

		try {
			setIsLoadingPatients(true)
			setPatientsErrorMessage(null)

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

			const reportPatients = (await response.json()) as DashboardPatientListItemResponse[]
			if (!signal?.aborted) {
				setPatients(reportPatients)
			}
		} catch (error) {
			if (signal?.aborted) {
				return
			}

			const message = error instanceof Error ? error.message : LOAD_PATIENTS_ERROR_MESSAGE
			setPatientsErrorMessage(message)
		} finally {
			if (!signal?.aborted) {
				setIsLoadingPatients(false)
			}
		}
	}, [logout, token])

	// Carrega dados agregados de pacientes para o mini relatorio.
	useEffect(() => {
		const controller = new AbortController()
		void loadPatientsReport(controller.signal)

		return () => {
			controller.abort()
		}
	}, [loadPatientsReport])

	// Cria preview local da nova imagem escolhida no FileInput.
	useEffect(() => {
		if (!selectedProfilePicture) {
			setProfileImagePreviewUrl(null)
			return
		}

		const objectUrl = URL.createObjectURL(selectedProfilePicture)
		setProfileImagePreviewUrl(objectUrl)

		return () => {
			URL.revokeObjectURL(objectUrl)
		}
	}, [selectedProfilePicture])

	// -----------------------------------------------------------------------
	// Valores derivados
	// -----------------------------------------------------------------------
	// A idade e sempre calculada a partir da data de nascimento preenchida.
	const ageText = getAgeFromMaskedBirthDate(profileForm.birthDate)
	const profileImageCandidateSrc = profileImagePreviewUrl ?? normalizeProfileImageSrc(currentUser?.profilePicture)
	const nutritionistFirstName = useMemo(() => {
		const normalizedName = currentUser?.name?.trim()
		if (!normalizedName) {
			return 'Nutricionista'
		}

		return normalizedName.split(/\s+/)[0]
	}, [currentUser?.name])
	const dashboardGreeting = `Bem vindo de volta, ${nutritionistFirstName}!`
	const isProfileImageSkeletonVisible = isLoadingUser || isProfileImageLoading

	useEffect(() => {
		let isCancelled = false
		const imageToLoad = profileImageCandidateSrc ?? FALLBACK_PROFILE_IMAGE_URL

		setIsProfileImageLoading(true)

		const preloadImage = new window.Image()
		preloadImage.onload = () => {
			if (isCancelled) {
				return
			}

			setResolvedProfileImageSrc(imageToLoad)
			setIsProfileImageLoading(false)
		}
		preloadImage.onerror = () => {
			if (isCancelled) {
				return
			}

			setResolvedProfileImageSrc(FALLBACK_PROFILE_IMAGE_URL)
			setIsProfileImageLoading(false)
		}
		preloadImage.src = imageToLoad

		return () => {
			isCancelled = true
			preloadImage.onload = null
			preloadImage.onerror = null
		}
	}, [profileImageCandidateSrc])

	const reportMetrics = useMemo(() => {
		const totalPatients = patients.length
		const thirtyDaysAgo = new Date()
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

		const averageBmi = totalPatients > 0
			? patients.reduce((accumulator, patient) => accumulator + patient.bmi, 0) / totalPatients
			: 0
		const ageValues = patients
			.map((patient) => calculateAgeFromIsoDate(patient.birthDate))
			.filter((value): value is number => value !== null)
		const averageAge = ageValues.length > 0
			? ageValues.reduce((accumulator, age) => accumulator + age, 0) / ageValues.length
			: 0
		const recentPatients = patients.filter((patient) => {
			const createdAt = new Date(patient.createdAt)
			return !Number.isNaN(createdAt.getTime()) && createdAt >= thirtyDaysAgo
		}).length
		const highRiskPatients = patients.filter((patient) => patient.bmi >= 30).length

		return {
			totalPatients,
			averageBmi,
			averageAge,
			recentPatients,
			highRiskPatients,
		}
	}, [patients])
	const genderChartData = useMemo(() => {
		const femaleCount = patients.filter((patient) => patient.gender === 'female').length
		const maleCount = patients.filter((patient) => patient.gender === 'male').length
		const otherCount = patients.filter((patient) => patient.gender !== 'female' && patient.gender !== 'male').length

		return [
			{ name: 'Feminino', value: femaleCount, color: 'pink.5' },
			{ name: 'Masculino', value: maleCount, color: 'blue.5' },
			{ name: 'Outro', value: otherCount, color: 'grape.5' },
		].filter((item) => item.value > 0)
	}, [patients])
	const activityChartData = useMemo(() => {
		return ACTIVITY_LEVEL_ORDER.map((level) => ({
			atividade: ACTIVITY_LEVEL_LABELS[level] ?? level,
			pacientes: patients.filter((patient) => patient.activityLevel === level).length,
		}))
	}, [patients])
	const monthlyPatientsTrendData = useMemo(() => {
		const totalMonths = 6
		const currentDate = new Date()
		const countByMonthKey = new Map<string, number>()

		patients.forEach((patient) => {
			const createdAt = new Date(patient.createdAt)
			if (Number.isNaN(createdAt.getTime())) {
				return
			}

			const monthKey = `${createdAt.getFullYear()}-${createdAt.getMonth()}`
			countByMonthKey.set(monthKey, (countByMonthKey.get(monthKey) ?? 0) + 1)
		})

		return Array.from({ length: totalMonths }, (_, index) => {
			const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - (totalMonths - 1 - index), 1)
			const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`
			const monthLabel = `${MONTH_LABELS[monthDate.getMonth()]}/${String(monthDate.getFullYear()).slice(-2)}`

			return {
				periodo: monthLabel,
				pacientes: countByMonthKey.get(key) ?? 0,
			}
		})
	}, [patients])
	const bmiDistributionData = useMemo(() => {
		const underweight = patients.filter((patient) => patient.bmi < 18.5).length
		const healthy = patients.filter((patient) => patient.bmi >= 18.5 && patient.bmi < 25).length
		const high = patients.filter((patient) => patient.bmi >= 25 && patient.bmi < 30).length
		const risk = patients.filter((patient) => patient.bmi >= 30).length

		return [
			{ name: 'Abaixo', value: underweight, color: 'yellow.6' },
			{ name: 'Saudavel', value: healthy, color: 'green.6' },
			{ name: 'Elevado', value: high, color: 'orange.6' },
			{ name: 'Alto risco', value: risk, color: 'red.6' },
		].filter((item) => item.value > 0)
	}, [patients])

	// -----------------------------------------------------------------------
	// Handlers de interacao
	// -----------------------------------------------------------------------
	// Aplica mascara de data (dd/mm/aaaa) no campo de nascimento.
	const handleBirthDateChange = (value: string) => {
		setProfileForm((previousState) => ({
			...previousState,
			birthDate: maskBirthDateInput(value),
		}))
	}

	const handleFieldChange = (field: keyof Omit<ProfileFormState, 'birthDate'>, value: string) => {
		setProfileForm((previousState) => ({
			...previousState,
			[field]: value,
		}))
	}

	// Entra no modo de edicao.
	const handleStartEditing = () => {
		setSaveErrorMessage(null)
		setSelectedProfilePicture(null)
		setIsEditing(true)
	}

	// Descarta alteracoes locais e volta para o valor atual salvo na API.
	const handleCancelEditing = () => {
		setSaveErrorMessage(null)
		setProfileForm(getInitialProfileFormState(currentUser))
		setSelectedProfilePicture(null)
		setIsEditing(false)
	}

	// Valida e envia os dados editados para persistencia no backend.
	const handleSaveChanges = async () => {
		if (!token || !currentUser) {
			return
		}

		setSaveErrorMessage(null)

		const birthDateForApi = toPostgresTimestamptz(profileForm.birthDate)
		if (profileForm.birthDate.trim().length > 0 && !birthDateForApi) {
			setSaveErrorMessage(INVALID_BIRTH_DATE_MESSAGE)
			return
		}

		const payload: UpdateCurrentUserRequest = {
			birthDate: birthDateForApi,
			institution: normalizeOptionalText(profileForm.institution),
			crn: normalizeOptionalText(profileForm.crn),
			city: normalizeOptionalText(profileForm.city),
			state: normalizeOptionalText(profileForm.state),
		}

		setIsSavingProfile(true)
		try {
			const response = await fetch(buildApiUrl('/api/users/me'), {
				method: 'POST',
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
				const errorMessage = await extractErrorMessage(response, SAVE_USER_ERROR_MESSAGE)
				throw new Error(errorMessage)
			}

			let updatedUser = (await response.json()) as CurrentUserResponse

			if (selectedProfilePicture) {
				const uploadFormData = new FormData()
				uploadFormData.append('file', selectedProfilePicture)

				const uploadResponse = await fetch(buildApiUrl('/api/users/me/profile-picture'), {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: 'application/json',
					},
					body: uploadFormData,
				})

				if (uploadResponse.status === 401) {
					logout()
					return
				}

				if (!uploadResponse.ok) {
					const uploadErrorMessage = await extractErrorMessage(uploadResponse, SAVE_USER_ERROR_MESSAGE)
					throw new Error(uploadErrorMessage)
				}

				updatedUser = (await uploadResponse.json()) as CurrentUserResponse
			}

			setCurrentUser(updatedUser)
			setProfileForm(getInitialProfileFormState(updatedUser))
			setSelectedProfilePicture(null)
			setIsEditing(false)
		} catch (error) {
			const message = error instanceof Error ? error.message : SAVE_USER_ERROR_MESSAGE
			setSaveErrorMessage(message)
		} finally {
			setIsSavingProfile(false)
		}
	}

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
						titleKey={dashboardGreeting}
						title={(
							<SplitText
								text={dashboardGreeting}
								className="text-lg font-semibold md:text-3xl leading-none text-white"
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
						titleAriaLabel={dashboardGreeting}
					/>
				</Box>

				<Box className="min-h-0 flex-1 p-3 md:p-6">
					{/* Conteudo principal dividido em duas colunas */}
					<PageContentContainer
						itemClassName="h-full"
						items={[
							<Grid
								columns={12}
								gutter="md"
								align="stretch"
								styles={{ inner: { height: '100%' } }}
								className="h-full min-h-[320px]"
							>
								<Grid.Col span={{ base: 12, md: 4 }}>
									{/* Coluna esquerda: dados de perfil e formulario de edicao */}
									<Box className="flex flex-col items-center justify-center gap-4">

										{/* Rederiza a imagem normalmente se não está em modo de edição, mas quando
											estiver editando, rederiza uma imagem menor mas com o fileInput */}


										{isEditing && (

											<Stack align="center" className="w-full">
												<Skeleton visible={isProfileImageSkeletonVisible} radius="md" className="mb-4">
													<Image
														src={resolvedProfileImageSrc}
														alt="Foto de perfil do nutricionista"
														radius="md"
														h={420}
														w={420}
														onError={() => setResolvedProfileImageSrc(FALLBACK_PROFILE_IMAGE_URL)}
													/>
												</Skeleton>
												<Group
													grow
													className="w-full h-full"
												>
													<FileInput
														label="Alterar foto de perfil"
														placeholder="Faça upload de uma nova foto"
														value={selectedProfilePicture}
														onChange={setSelectedProfilePicture}
														accept="image/png,image/jpeg,image/webp"
														disabled={!isEditing || isSavingProfile}
														clearable
														radius="md"
														classNames={textInputClassNames}
													/>
												</Group>
											</Stack>
										)}

										{!isEditing && (
											<Box className="flex items-center justify-center">
												<Skeleton visible={isProfileImageSkeletonVisible} radius="md" className="mb-4">
													<Image
														src={resolvedProfileImageSrc}
														alt="Foto de perfil do nutricionista"
														radius="md"
														h={500}
														w={500}
														onError={() => setResolvedProfileImageSrc(FALLBACK_PROFILE_IMAGE_URL)}
													/>
												</Skeleton>
											</Box>
										)}

										<Group grow className="w-full h-full">
											<TextInput
												label="Nome"
												placeholder="Nome do Nutricionista"
												value={currentUser?.name ?? ''}
												disabled
												radius="md"
												classNames={textInputClassNames}
											/>
										</Group>

										<Group grow className="w-full h-full">
											<TextInput
												label="Email"
												placeholder="Email do Nutricionista"
												value={currentUser?.email ?? ''}
												disabled
												radius="md"
												classNames={textInputClassNames}
											/>
										</Group>

										<Group grow className="w-full h-full">
											<TextInput
												label="Data de Nascimento"
												placeholder="dd/mm/aaaa"
												value={profileForm.birthDate}
												onChange={(event) => handleBirthDateChange(event.currentTarget.value)}
												inputMode="numeric"
												maxLength={10}
												disabled={!isEditing}
												radius="md"
												classNames={textInputClassNames}
											/>

											<TextInput
												label="Idade"
												placeholder="Idade do Nutricionista"
												value={ageText}
												disabled
												radius="md"
												classNames={textInputClassNames}
											/>
										</Group>

										<Group grow className="w-full h-full">
											<TextInput
												label="Instituição de Formação"
												placeholder="Instituição de Formação do Nutricionista"
												value={profileForm.institution}
												onChange={(event) => handleFieldChange('institution', event.currentTarget.value)}
												disabled={!isEditing}
												radius="md"
												classNames={textInputClassNames}
											/>

											<TextInput
												label="CRN"
												placeholder="CRN do Nutricionista"
												value={profileForm.crn}
												onChange={(event) => handleFieldChange('crn', event.currentTarget.value)}
												disabled={!isEditing}
												radius="md"
												classNames={textInputClassNames}
											/>
										</Group>

										<Group grow className="w-full h-full">
											<TextInput
												label="Cidade"
												placeholder="Cidade do Nutricionista"
												value={profileForm.city}
												onChange={(event) => handleFieldChange('city', event.currentTarget.value)}
												disabled={!isEditing}
												radius="md"
												classNames={textInputClassNames}
											/>

											<TextInput
												label="Estado"
												placeholder="Estado do Nutricionista"
												value={profileForm.state}
												onChange={(event) => handleFieldChange('state', event.currentTarget.value)}
												disabled={!isEditing}
												radius="md"
												classNames={textInputClassNames}
											/>
										</Group>

										<Divider orientation="horizontal" size="sm" className="w-full my-4" />

										{saveErrorMessage && (
											<Text c="red.6" size="sm">
												{saveErrorMessage}
											</Text>
										)}

										{isEditing ? (
											<Group grow className="w-full h-full">
												<Button
													fullWidth
													radius="md"
													classNames={confirmButtonClassNames}
													loading={isSavingProfile}
													onClick={() => void handleSaveChanges()}
												>
													Salvar Alterações
												</Button>

												<Button
													fullWidth
													radius="md"
													variant="outline"
													classNames={cancelButtonClassNames}
													onClick={handleCancelEditing}
												>
													Cancelar
												</Button>
											</Group>
										) : (
											<Group grow className="w-full h-full">
												<Button
													fullWidth
													radius="md"
													classNames={editButtonClassNames}
													onClick={handleStartEditing}
												>
													Editar Perfil
												</Button>
											</Group>
										)}
									</Box>
								</Grid.Col>

								<Grid.Col
									span={{ base: 12, md: 1 }}
									className="flex h-full items-stretch justify-center"
								>
									{/* Separador visual entre coluna de perfil e area de dashboard */}
									<Divider orientation="vertical" size="sm" />
								</Grid.Col>

									<Grid.Col span={{ base: 12, md: 7 }} className="min-h-0">
										<Box className="flex h-full min-h-0 flex-col gap-4 overflow-auto pr-1">
											<Box className="rounded-[28px] border border-[#c8e4ef] bg-[linear-gradient(125deg,rgba(39,144,176,0.12)_0%,rgba(148,186,101,0.13)_52%,rgba(255,255,255,0.98)_100%)] p-4 sm:p-5">
												<Box className="max-w-[620px]">
													<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
														Mini relatorio
													</Text>
													<Text className="mt-1 text-lg font-semibold text-slate-900 md:text-xl">
														Visao geral dos pacientes
													</Text>
												</Box>
											</Box>

										{isLoadingPatients ? (
											<Box className="flex min-h-0 flex-1 flex-col gap-3">
												<Box className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
													{Array.from({ length: 4 }).map((_, index) => (
														<Box
															key={`dashboard-metric-skeleton-${index}`}
															className="rounded-2xl border border-[#d4e4ea] bg-white p-3"
														>
															<Skeleton height={11} width="46%" radius="sm" />
															<Skeleton className="mt-2" height={28} width="42%" radius="sm" />
														</Box>
													))}
												</Box>

												<Box className="rounded-2xl border border-[#d6e4ea] bg-white p-3">
													<Skeleton height={16} width="58%" radius="sm" />
												</Box>

												<Box className="grid gap-3 xl:grid-cols-2">
													{Array.from({ length: 2 }).map((_, cardIndex) => (
														<Box
															key={`dashboard-donut-skeleton-${cardIndex}`}
															className="flex min-h-[290px] flex-col rounded-3xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-4"
														>
															<Skeleton height={11} width="36%" radius="sm" />
															<Box className="mt-3 grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(180px,0.85fr)] md:items-center">
																<Box className="flex min-h-[220px] items-center justify-center rounded-2xl border border-[#e1edf2] bg-white/70">
																	<Skeleton height={180} circle />
																</Box>

																<Box className="grid gap-2">
																	{Array.from({ length: 3 }).map((_, itemIndex) => (
																		<Skeleton
																			key={`dashboard-donut-legend-skeleton-${cardIndex}-${itemIndex}`}
																			height={34}
																			radius="xl"
																		/>
																	))}
																</Box>
															</Box>
														</Box>
													))}
												</Box>

												<Box className="grid min-h-0 flex-1 gap-3 xl:grid-cols-2">
													{Array.from({ length: 2 }).map((_, chartIndex) => (
														<Box
															key={`dashboard-chart-skeleton-${chartIndex}`}
															className="flex min-h-[310px] flex-col rounded-3xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-4"
														>
															<Skeleton height={11} width="34%" radius="sm" />
															<Skeleton className="mt-3 flex-1" radius="md" />
														</Box>
													))}
												</Box>
											</Box>
										) : patientsErrorMessage ? (
											<Box className="flex min-h-[300px] flex-1 flex-col justify-center rounded-3xl border border-red-200 bg-red-50/80 p-5">
												<Text c="red.7" fw={600}>
													{patientsErrorMessage}
												</Text>
												<Group className="mt-3">
													<Button
														type="button"
														radius="md"
														classNames={editButtonClassNames}
														onClick={() => void loadPatientsReport()}
													>
														Tentar novamente
													</Button>
												</Group>
											</Box>
										) : patients.length === 0 ? (
											<Box className="flex min-h-[300px] flex-1 items-center rounded-3xl border border-[hsl(var(--border))] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-5">
												<Text className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
													Sem pacientes cadastrados para montar o relatorio.
												</Text>
											</Box>
										) : (
											<Box className="flex min-h-0 flex-1 flex-col gap-3">
												<Box className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
													<Box className="rounded-2xl border border-[#d4e4ea] bg-white p-3">
														<Text className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
															Pacientes totais
														</Text>
														<Text className="mt-1 text-2xl font-semibold text-slate-900">
															{reportMetrics.totalPatients}
														</Text>
													</Box>

													<Box className="rounded-2xl border border-[#d4e4ea] bg-white p-3">
														<Text className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
															IMC medio
														</Text>
														<Text className="mt-1 text-2xl font-semibold text-slate-900">
															{reportMetrics.averageBmi.toFixed(1)}
														</Text>
													</Box>

													<Box className="rounded-2xl border border-[#d4e4ea] bg-white p-3">
														<Text className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
															Idade media
														</Text>
														<Text className="mt-1 text-2xl font-semibold text-slate-900">
															{Math.round(reportMetrics.averageAge)} anos
														</Text>
													</Box>

													<Box className="rounded-2xl border border-[#d4e4ea] bg-white p-3">
														<Text className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
															Novos (30 dias)
														</Text>
														<Text className="mt-1 text-2xl font-semibold text-slate-900">
															{reportMetrics.recentPatients}
														</Text>
													</Box>
												</Box>

												<Box className="rounded-2xl border border-[#d6e4ea] bg-white p-3">
													<Text className="text-sm font-medium text-slate-600">
														{reportMetrics.highRiskPatients} pacientes estao na faixa de alto risco de IMC.
													</Text>
												</Box>

												<Box className="grid gap-3 xl:grid-cols-2">
													<Box className="flex min-h-[290px] flex-col rounded-3xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-4">
														<Text className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
															Distribuicao por sexo
														</Text>
														<Box className="mt-3 grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(180px,0.85fr)] md:items-center">
															<Box className="flex min-h-[220px] items-center justify-center rounded-2xl border border-[#e1edf2] bg-white/70">
																<DonutChart
																	className="w-full"
																	h={220}
																	data={genderChartData}
																	chartLabel={reportMetrics.totalPatients}
																	size={185}
																	thickness={28}
																	tooltipDataSource="segment"
																/>
															</Box>

															<Box className="grid gap-2">
																{genderChartData.map((segment) => (
																	<Box
																		key={`gender-${segment.name}`}
																		className="rounded-xl border border-[#deebf1] bg-white/85 px-3 py-2"
																	>
																		<Group justify="space-between" align="center" gap="xs">
																			<Group gap={8} wrap="nowrap">
																				<Box
																					component="span"
																					className="h-2.5 w-2.5 rounded-full"
																					bg={segment.color}
																				/>
																				<Text className="text-xs font-semibold text-slate-700">
																					{segment.name}
																				</Text>
																			</Group>

																			<Text className="text-xs font-semibold text-slate-600">
																				{segment.value} ({formatPercent(segment.value, reportMetrics.totalPatients)})
																			</Text>
																		</Group>
																	</Box>
																))}
															</Box>
														</Box>
													</Box>

													<Box className="flex min-h-[290px] flex-col rounded-3xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-4">
														<Text className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
															Faixas de IMC
														</Text>
														<Box className="mt-3 grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(180px,0.85fr)] md:items-center">
															<Box className="flex min-h-[220px] items-center justify-center rounded-2xl border border-[#e1edf2] bg-white/70">
																<DonutChart
																	className="w-full"
																	h={220}
																	data={bmiDistributionData}
																	size={185}
																	thickness={28}
																	tooltipDataSource="segment"
																/>
															</Box>

															<Box className="grid gap-2">
																{bmiDistributionData.map((segment) => (
																	<Box
																		key={`bmi-${segment.name}`}
																		className="rounded-xl border border-[#deebf1] bg-white/85 px-3 py-2"
																	>
																		<Group justify="space-between" align="center" gap="xs">
																			<Group gap={8} wrap="nowrap">
																				<Box
																					component="span"
																					className="h-2.5 w-2.5 rounded-full"
																					bg={segment.color}
																				/>
																				<Text className="text-xs font-semibold text-slate-700">
																					{segment.name}
																				</Text>
																			</Group>

																			<Text className="text-xs font-semibold text-slate-600">
																				{segment.value} (
																				{formatPercent(
																					segment.value,
																					bmiDistributionData.reduce((total, item) => total + item.value, 0),
																				)}
																				)
																			</Text>
																		</Group>
																	</Box>
																))}
															</Box>
														</Box>
													</Box>
												</Box>

												<Box className="grid min-h-0 flex-1 gap-3 xl:grid-cols-2">
													<Box className="flex min-h-[310px] flex-col rounded-3xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-4">
														<Text className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
															Niveis de atividade
														</Text>
														<BarChart
															className="mt-3 flex-1"
															h="100%"
															data={activityChartData}
															dataKey="atividade"
															series={[{ name: 'pacientes', color: 'cyan.6' }]}
															strokeDasharray="3 3"
															gridAxis="xy"
															tickLine="xy"
															withYAxis={false}
															valueFormatter={(value) => `${value} pacientes`}
														/>
													</Box>

													<Box className="flex min-h-[310px] flex-col rounded-3xl border border-[#d2e4eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-4">
														<Text className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
															Cadastros por mes
														</Text>
														<LineChart
															className="mt-3 flex-1"
															h="100%"
															data={monthlyPatientsTrendData}
															dataKey="periodo"
															series={[{ name: 'pacientes', color: 'teal.6' }]}
															curveType="monotone"
															strokeWidth={3}
															withDots={false}
															gridAxis="xy"
															tickLine="xy"
															valueFormatter={(value) => `${value} pacientes`}
														/>
													</Box>
												</Box>
											</Box>
										)}
									</Box>
								</Grid.Col>
							</Grid>,
						]}
					/>
				</Box>
			</Box>
		</Box>
	)
}
