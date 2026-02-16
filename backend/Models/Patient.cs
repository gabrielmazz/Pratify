// Patient.cs -> Entidade de dominio que representa um paciente no sistema 
//
// PAPEL DA ENTIDADE
// - Define os campos persistidos na tabela patients.
// - E usada para armazenar informacoes basicas dos pacientes, como nome, email e data de nascimento.
// - Serve de base para associar pacientes a consultas, historico medico, etc.
// OBSERVACOES DE SEGURANCA
// - A entidade Patient nao tem campos sensiveis, mas deve ser protegida por 
// autorizacao adequada para evitar acesso nao autorizado aos dados dos pacientes

namespace Backend.Models
{
    public class Patient
    {
        // Identificador unico do paciente (PK).
        public int Id { get; set; }

        // Identificador do usuario nutricionista associado a este paciente (FK).
        public int UserId { get; set; }

        // Nome completo do paciente.
        public string Name { get; set; } = string.Empty;

        // Data de nascimento do paciente.
        public DateTime BirthDate { get; set; }

        // Sexo do paciente 
        public string Gender { get; set; } = string.Empty;

        // Peso do paciente em kg.
        public float Weight { get; set; }

        // Altura do paciente em cm.
        public float Height { get; set; }

        // IMC calculado a partir do peso e altura.
        public float BMI { get; set; }

        // Objetivo do paciente (ex: perda de peso, ganho de massa, manutencao).
        public string Goal { get; set; } = string.Empty;

        // Data de criacao do registro em UTC.
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Classificação de exercício do paciente (ex: sedentário, leve, moderado, intenso).
        public string ActivityLevel { get; set; } = string.Empty;

        // Condições médicas pré-existentes do paciente (ex: diabetes, hipertensão), podendo ser mais de uma
        // condicao separada, sendo uma lista
        public List<string> MedicalConditions { get; set; } = new List<string>();

        // Circunferencia do braco do paciente em cm.
        public float ArmCircumference { get; set; }

        // Circunferencia da cintura do paciente em cm.
        public float WaistCircumference { get; set; }  

        // Circunferencia do quadril do paciente em cm.
        public float HipCircumference { get; set; }

        // Circunferencia da coxa do paciente em cm.
        public float ThighCircumference { get; set; }

        // Subescapular skinfold em mm.
        public float SubscapularSkinfold { get; set; }

        // Axililar média em mm.
        public float AxillarySkinfold { get; set; }

        // Suprailiaca em mm.
        public float SuprailiacSkinfold { get; set; }

        // Abdominal em mm.
        public float AbdominalSkinfold { get; set; }

        // TMB (Taxa Metabólica Basal) calculada a partir de fórmulas como Harris-Benedict ou Mifflin-St Jeor.
        public float BMR { get; set; }

        // GET (Gasto Energético Total) calculado a partir do BMR e do nível de atividade física.
        public float TDEE { get; set; }

    }
}