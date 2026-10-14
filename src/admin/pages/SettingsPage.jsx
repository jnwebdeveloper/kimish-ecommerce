import ShiprocketPickupPanel from '../components/ShiprocketPickupPanel'
import ModulePage from './ModulePage'

export default function SettingsPage() {
  return <ModulePage module="settings" intro={<ShiprocketPickupPanel />} />
}
