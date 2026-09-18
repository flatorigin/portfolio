from decimal import Decimal

from rest_framework.exceptions import ValidationError

from .estimators import _money, _money_string, _clean_list, _signed_decimal
from .paving_estimators import choice, number, quantity, text


def finalize_section_estimate(raw, normalized, results, version):
    inputs = {'sections': normalized}
    for key in ('prepared_by', 'client_name', 'project_location', 'notes'):
        inputs[key] = text(raw, key, limit=2000)
    for key in ('included_scope', 'excluded_scope'):
        inputs[key] = _clean_list(raw.get(key), key)
    inputs['profit_method'] = choice(raw, 'profit_method', ('markup', 'margin'), 'markup')
    inputs['discount_type'] = choice(raw, 'discount_type', ('percent', 'fixed'), 'percent')
    inputs['output_preference'] = choice(raw, 'output_preference', ('detailed', 'summary'), 'detailed')
    for key in ('overhead', 'profit', 'tax', 'discount', 'minimum', 'allowances'):
        maximum = '95' if key == 'profit' and inputs['profit_method'] == 'margin' else '500' if key == 'profit' else '100' if key in ('overhead', 'tax') or (key == 'discount' and inputs['discount_type'] == 'percent') else '1000000'
        inputs[key] = quantity(number(raw, key, maximum=maximum))
    inputs['adjustment'] = _money_string(_signed_decimal(raw.get('adjustment', 0), 'adjustment'))
    n = lambda key: Decimal(inputs[key])
    direct = sum((Decimal(section['subtotal']) for section in results), Decimal('0')) + _money(n('allowances'))
    overhead = _money(direct * n('overhead') / 100)
    basis = direct + overhead
    selling = _money(basis / (1 - n('profit') / 100)) if inputs['profit_method'] == 'margin' else basis + _money(basis * n('profit') / 100)
    adjusted = max(Decimal('0'), _money(n('minimum')), selling + n('adjustment'))
    tax = _money(adjusted * n('tax') / 100)
    subtotal = adjusted + tax
    discount = min(subtotal, _money(subtotal * n('discount') / 100) if inputs['discount_type'] == 'percent' else _money(n('discount')))
    if max(direct, subtotal) > Decimal('9999999999.99'):
        raise ValidationError({'inputs': 'Estimate exceeds the supported price limit.'})
    return inputs, {'version': version, 'sections': results, 'direct_cost': _money_string(direct),
                    'overhead_amount': _money_string(overhead), 'tax_amount': _money_string(tax),
                    'subtotal': _money_string(subtotal), 'discount_amount': _money_string(discount),
                    'final_price': _money_string(subtotal - discount)}

