-- Caller privileges and existing RLS protect both aggregate and link resolution.
create function public.report_scan_counts(p_workspace_id uuid, p_scan_ids uuid[])
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if coalesce(array_length(p_scan_ids, 1), 0) > 25 then
    raise exception 'At most 25 scans per request' using errcode = '22023';
  end if;
  return coalesce((select jsonb_object_agg(c.id::text, jsonb_build_object('total', c.total, 'severity',
    jsonb_build_object('critical', c.critical, 'high', c.high, 'medium', c.medium, 'low', c.low)))
    from (select s.id, count(f.id) as total,
      count(f.id) filter (where f.severity = 'critical') as critical,
      count(f.id) filter (where f.severity = 'high') as high,
      count(f.id) filter (where f.severity = 'medium') as medium,
      count(f.id) filter (where f.severity = 'low') as low
      from public.scans s left join public.findings f on f.scan_id = s.id
      where s.workspace_id = p_workspace_id and s.id = any(p_scan_ids) and s.status = 'completed'
      group by s.id) c), '{}'::jsonb);
end;
$$;
revoke all on function public.report_scan_counts(uuid, uuid[]) from public, anon;
grant execute on function public.report_scan_counts(uuid, uuid[]) to authenticated;

create function public.resolve_report_scan(p_workspace_id uuid, p_reference text)
returns table(id uuid) language sql stable security invoker set search_path = '' as $$
  select s.id from public.scans s
  where s.workspace_id = p_workspace_id and s.status = 'completed'
    and p_reference = 'rep_' || left(s.id::text, 16)
  order by s.id limit 2;
$$;
revoke all on function public.resolve_report_scan(uuid, text) from public, anon;
grant execute on function public.resolve_report_scan(uuid, text) to authenticated;
