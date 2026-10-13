export function validateDelivery(customer = {}) {
  const errors = {}
  const value = key => String(customer[key] ?? '').trim()
  if (value('name').length < 2 || value('name').length > 100) errors.name = 'Enter your full name (2–100 characters).'
  if (!/^[6-9]\d{9}$/.test(value('mobile'))) errors.mobile = 'Enter a valid 10-digit Indian mobile number.'
  if (value('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email'))) errors.email = 'Enter a valid email address or leave this blank.'
  if (!/^\d{6}$/.test(value('pincode'))) errors.pincode = 'Enter a valid 6-digit PIN code.'
  if (value('address').length < 8 || value('address').length > 300) errors.address = 'Enter your complete delivery address (8–300 characters).'
  if (value('city').length < 2 || value('city').length > 100) errors.city = 'Enter a valid city name.'
  if (value('state').length < 2 || value('state').length > 100) errors.state = 'Enter a valid state name.'
  if (value('landmark').length > 150) errors.landmark = 'Landmark must be under 150 characters.'
  return errors
}
