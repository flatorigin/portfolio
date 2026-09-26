"""Itemized residential electrical scopes with editable contractor pricing."""
from decimal import Decimal

from rest_framework.exceptions import ValidationError

from .estimators import _money_string
from .paving_estimators import number, quantity, text
from .section_estimator_pricing import finalize_section_estimate


def calculate_electrical_estimate(raw, trade="electrical"):
    if not isinstance(raw, dict):
        raise ValidationError({'inputs': 'Expected an object.'})
    projects = raw.get('projects')
    if not isinstance(projects, list) or not 1 <= len(projects) <= 50:
        raise ValidationError({'projects': f'Add 1 to 50 {trade} projects.'})

    normalized, results = [], []
    for project_index, item in enumerate(projects):
        if not isinstance(item, dict):
            raise ValidationError({'projects': f'Each {trade} project must be an object.'})
        project = {
            'id': text(item, 'id', str(project_index), limit=100),
            'service_id': text(item, 'service_id', 'custom', limit=100),
            'name': text(item, 'name', 'Electrical project', limit=240),
            'location': text(item, 'location', '', limit=240),
            'notes': text(item, 'notes', '', limit=1000),
        }
        if 'ev_options' in item:
            options = item['ev_options']
            if not isinstance(options, dict):
                raise ValidationError({'ev_options': 'Expected charger configuration.'})
            project['ev_options'] = {'distance': float(number(options, 'distance', 30, maximum='300'))}
            for key, choices, default in [
                ('route', {'open', 'finished', 'exterior', 'trench'}, 'open'),
                ('panel', {'unknown', 'ready', 'space', 'managed', 'upgrade'}, 'unknown'),
                ('connection', {'hardwired', 'receptacle'}, 'hardwired'),
            ]:
                value = options.get(key, default)
                if not isinstance(value, str) or value not in choices:
                    raise ValidationError({'ev_options': f'Invalid {key}.'})
                project['ev_options'][key] = value
            for key in ['detached', 'includeCharger']:
                value = options.get(key, False)
                if not isinstance(value, bool):
                    raise ValidationError({'ev_options': f'{key} must be true or false.'})
                project['ev_options'][key] = value
        if not project['name']:
            raise ValidationError({'projects': 'Enter a project name.'})
        raw_lines = item.get('line_items')
        if not isinstance(raw_lines, list) or not 1 <= len(raw_lines) <= 40:
            raise ValidationError({'line_items': 'Add 1 to 40 scope items per project.'})
        lines, calculated_lines = [], []
        for line_index, raw_line in enumerate(raw_lines):
            if not isinstance(raw_line, dict):
                raise ValidationError({'line_items': 'Each scope item must be an object.'})
            line = {
                'id': text(raw_line, 'id', f'{project_index}-{line_index}', limit=100),
                'name': text(raw_line, 'name', 'Electrical work', limit=240),
                'unit': text(raw_line, 'unit', 'allowance', limit=80),
                'detail': text(raw_line, 'detail', '', limit=500),
                'required': bool(raw_line.get('required', True)),
                'included': bool(raw_line.get('included', True)),
            }
            if not isinstance(raw_line.get('required', True), bool) or not isinstance(raw_line.get('included', True), bool):
                raise ValidationError({'line_items': 'Required and included values must be true or false.'})
            line['quantity'] = quantity(number(raw_line, 'quantity', 1, maximum='100000'))
            line['unit_price'] = quantity(number(raw_line, 'unit_price', 0, maximum='1000000'))
            line['homeowner_unit_price'] = quantity(number(raw_line, 'homeowner_unit_price', line['unit_price'], maximum='1000000'))
            amount = Decimal(line['quantity']) * Decimal(line['unit_price']) if line['included'] else Decimal('0')
            calculated_lines.append({
                **line,
                'amount': _money_string(amount),
                'customer_supplied': False,
            })
            lines.append(line)
        subtotal = sum((Decimal(line['amount']) for line in calculated_lines), Decimal('0'))
        normalized.append({**project, 'line_items': lines})
        results.append({
            'name': project['name'],
            'material': project['location'],
            'notes': project['notes'],
            'quantity_summary': f"{len(calculated_lines)} itemized scope items",
            'line_items': calculated_lines,
            'subtotal': _money_string(subtotal),
        })

    prepared = dict(raw)
    prepared['sections'] = normalized
    inputs, calculation = finalize_section_estimate(prepared, normalized, results, f'{trade}-v1')
    inputs['projects'] = inputs.pop('sections')
    inputs['pricing_year'] = '2026-27'
    inputs['permit_fees_excluded'] = True
    return inputs, calculation
