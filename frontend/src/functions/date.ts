const DATE_MASK_MAX_DIGITS = 8

function isValidBirthYear(year: number, now: Date = new Date()): boolean {
	const currentYear = now.getFullYear()
	return year >= 1900 && year <= currentYear
}

function padDateSegment(segment: number): string {
	return String(segment).padStart(2, '0')
}

function parseMaskedDateParts(maskedDate: string): { day: number, month: number, year: number } | null {
	const match = maskedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
	if (!match) {
		return null
	}

	const day = Number(match[1])
	const month = Number(match[2])
	const year = Number(match[3])
	if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
		return null
	}

	return { day, month, year }
}

function buildUtcDate(day: number, month: number, year: number): Date | null {
	const utcDate = new Date(Date.UTC(year, month - 1, day))
	if (
		utcDate.getUTCFullYear() !== year ||
		utcDate.getUTCMonth() !== month - 1 ||
		utcDate.getUTCDate() !== day
	) {
		return null
	}

	return utcDate
}

export function maskBirthDateInput(value: string): string {
	const digitsOnly = value.replace(/\D/g, '').slice(0, DATE_MASK_MAX_DIGITS)
	if (digitsOnly.length <= 2) {
		return digitsOnly
	}

	if (digitsOnly.length <= 4) {
		return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`
	}

	return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`
}

export function formatBirthYear(birthDate: number | string | null | undefined): string {
	const year = getBirthYearFromDateString(birthDate)
	if (year == null) {
		return ''
	}

	return String(year)
}

export function formatBirthDateForInput(birthDate: number | string | null | undefined): string {
	if (birthDate == null) {
		return ''
	}

	if (typeof birthDate === 'number') {
		if (!Number.isFinite(birthDate) || !isValidBirthYear(birthDate)) {
			return ''
		}

		return `01/01/${birthDate}`
	}

	const maskedParts = parseMaskedDateParts(birthDate)
	if (maskedParts) {
		const maskedDate = buildUtcDate(maskedParts.day, maskedParts.month, maskedParts.year)
		if (maskedDate) {
			return `${padDateSegment(maskedParts.day)}/${padDateSegment(maskedParts.month)}/${maskedParts.year}`
		}
	}

	const parsed = new Date(birthDate)
	if (!Number.isNaN(parsed.getTime())) {
		return `${padDateSegment(parsed.getUTCDate())}/${padDateSegment(parsed.getUTCMonth() + 1)}/${parsed.getUTCFullYear()}`
	}

	const year = getBirthYearFromDateString(birthDate)
	if (year == null) {
		return ''
	}

	return `01/01/${year}`
}

export function parseBirthDateFromMaskedInput(maskedDate: string | null | undefined): Date | null {
	if (!maskedDate) {
		return null
	}

	const parts = parseMaskedDateParts(maskedDate)
	if (!parts || !isValidBirthYear(parts.year)) {
		return null
	}

	return buildUtcDate(parts.day, parts.month, parts.year)
}

export function getAgeFromBirthYear(birthYear: number | null | undefined, now: Date = new Date()): string {
	if (birthYear == null || !Number.isFinite(birthYear) || !isValidBirthYear(birthYear, now)) {
		return ''
	}

	return String(now.getFullYear() - birthYear)
}

export function getAgeFromMaskedBirthDate(maskedDate: string | null | undefined, now: Date = new Date()): string {
	const birthDate = parseBirthDateFromMaskedInput(maskedDate)
	if (!birthDate) {
		return ''
	}

	let age = now.getUTCFullYear() - birthDate.getUTCFullYear()
	const hasNotHadBirthdayYet =
		now.getUTCMonth() < birthDate.getUTCMonth() ||
		(now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate())

	if (hasNotHadBirthdayYet) {
		age -= 1
	}

	return age >= 0 ? String(age) : ''
}

export function toPostgresTimestamptz(maskedDate: string | null | undefined): string | null {
	const birthDate = parseBirthDateFromMaskedInput(maskedDate)
	if (!birthDate) {
		return null
	}

	return birthDate.toISOString()
}

export function getBirthYearFromDateString(dateValue: number | string | null | undefined): number | null {
	if (dateValue == null) {
		return null
	}

	if (typeof dateValue === 'number') {
		if (!Number.isFinite(dateValue) || !isValidBirthYear(dateValue)) {
			return null
		}

		return dateValue
	}

	const maskedParts = parseMaskedDateParts(dateValue)
	if (maskedParts) {
		const maskedDate = buildUtcDate(maskedParts.day, maskedParts.month, maskedParts.year)
		if (!maskedDate || !isValidBirthYear(maskedParts.year)) {
			return null
		}

		return maskedParts.year
	}

	const parsed = new Date(dateValue)
	if (!Number.isNaN(parsed.getTime())) {
		const year = parsed.getUTCFullYear()
		return isValidBirthYear(year) ? year : null
	}

	const match = dateValue.match(/(\d{4})/)
	if (!match) {
		return null
	}

	const year = Number(match[1])
	return Number.isFinite(year) && isValidBirthYear(year) ? year : null
}
