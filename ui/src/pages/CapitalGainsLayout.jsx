import { Outlet } from 'react-router-dom'
import { CapitalGainsFlowProvider } from '../engine/taxPreview/TaxFlowEngine.jsx'

export default function CapitalGainsLayout() {
  return (
    <CapitalGainsFlowProvider>
      <Outlet />
    </CapitalGainsFlowProvider>
  )
}
