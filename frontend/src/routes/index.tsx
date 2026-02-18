import { Navigate, Route, Routes } from 'react-router-dom'
import { AddPatientPage } from '../pages/AddPatientPage'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { MenuBuilderPage } from '../pages/MenuBuilderPage'
import { PatientDetailsPage } from '../pages/PatientDetailsPage'
import { PatientsPage } from '../pages/PatientsPage'
import { ProtectedRoute } from './ProtectedRoute'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/new" element={<AddPatientPage />} />
        <Route path="/patients/:patientId/edit" element={<AddPatientPage />} />
        <Route path="/patients/:patientId/menu" element={<MenuBuilderPage />} />
        <Route path="/patients/:patientId" element={<PatientDetailsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
