import HealthDigitizationDialog from '@/features/health/HealthDigitizationDialog';

// Unificar la carga médica: cámara/PDF privados y revisión con alcance por rama.
export default function ImportarFichaSaludDialog(props) {
  return <HealthDigitizationDialog key={props.beneficiario.id} {...props}/>;
}
