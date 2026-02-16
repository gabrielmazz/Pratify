import { useEffect, useState } from 'react'
import { Box, Grid, Text, Divider, Image, TextInput, Group, Button, FileInput, Stack } from '@mantine/core'

import TextInputStyle from '../components/mantine/inputs/TextInput.module.css'
import ButtonStyle from '../components/mantine/buttons/PrimaryButton.module.css'

import { SideBar } from '../components/custom/sidebar/SideBar'
import { PageInfo } from '../components/custom/pageInfo/PageInfo'
import { PageContentContainer } from '../components/custom/pageContentContainer/PageContentContainer'

import SplitText from '../components/react-bits/SplitText'
import { useAuth } from '../auth/AuthContext'
import { formatBirthDateForInput, getAgeFromMaskedBirthDate, maskBirthDateInput, toPostgresTimestamptz } from '../functions/date'

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

// ---------------------------------------------------------------------------
// Configuracao da pagina
// ---------------------------------------------------------------------------
// URL base da API (com fallback para chamadas relativas em ambiente local).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
// Imagem usada quando o usuario nao possui foto de perfil.
const FALLBACK_PROFILE_IMAGE_URL = 'https://thumbs.dreamstime.com/b/test-icon-vector-question-mark-male-user-person-profile-avatar-symbol-help-sign-glyph-pictogram-test-icon-vector-168495430.jpg'
// Mensagens padrao de erro para manter o texto consistente na tela.
const LOAD_USER_ERROR_MESSAGE = 'Nao foi possivel carregar os dados do usuario.'
const SAVE_USER_ERROR_MESSAGE = 'Nao foi possivel salvar as alteracoes do perfil.'
const INVALID_BIRTH_DATE_MESSAGE = 'Informe uma data valida no formato dd/mm/aaaa.'

// ---------------------------------------------------------------------------
// Mapeamento de estilos dos componentes Mantine
// ---------------------------------------------------------------------------
const textInputClassNames = {
	root: TextInputStyle.root,
	label: TextInputStyle.label,
	required: TextInputStyle.required,
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
	// Estados reservados para fluxo de carregamento inicial.
	const [, setIsLoadingUser] = useState(true)
	const [, setUserError] = useState<string | null>(null)

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
	const profileImageSrc = profileImagePreviewUrl ?? currentUser?.profilePicture ?? FALLBACK_PROFILE_IMAGE_URL

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
				items={[]}
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
								text={`Bem vindo de volta, ${currentUser?.name.split(' ')[0] ?? 'Nutricionista'}!`}
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
												<Image
													src={profileImageSrc}
													alt="Profile"
													radius="md"
													h={420}
													w={420}
													className="mb-4"
												/>
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
											<Image
												src={profileImageSrc}
												alt="Profile"
												radius="md"
												h={500}
												w={500}
												className="mb-4"
											/>
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

								<Grid.Col span={{ base: 12, md: 7 }}>
									{/* Coluna direita: area futura de widgets/conteudos do dashboard */}
									<Text className="text-gray-600">Conteúdo do dashboard aqui</Text>
								</Grid.Col>
							</Grid>,
						]}
					/>
				</Box>
			</Box>
		</Box>
	)
}
