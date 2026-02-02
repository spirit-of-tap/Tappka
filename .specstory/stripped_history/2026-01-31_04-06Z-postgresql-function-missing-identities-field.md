
{
  "event_message": "record \"new\" has no field \"identities\"",
  "id": "058c7a5d-d69c-414d-8100-03716efa68ce",
  "metadata": [
    {
      "file": null,
      "host": "db-kthplniuiqiszuzhpxmy",
      "metadata": [],
      "parsed": [
        {
          "application_name": null,
          "backend_type": "client backend",
          "command_tag": "INSERT",
          "connection_from": "127.0.0.1:36753",
          "context": "SQL expression \"new.identities is not null\"\nPL/pgSQL function public.handle_new_google_user() line 11 at IF",
          "database_name": "postgres",
          "detail": null,
          "error_severity": "ERROR",
          "hint": null,
          "internal_query": null,
          "internal_query_pos": null,
          "leader_pid": null,
          "location": null,
          "process_id": 480625,
          "query": "INSERT INTO \"users\" (\"aud\", \"banned_until\", \"confirmation_sent_at\", \"confirmation_token\", \"created_at\", \"deleted_at\", \"email\", \"email_change\", \"email_change_confirm_status\", \"email_change_sent_at\", \"email_change_token_current\", \"email_change_token_new\", \"email_confirmed_at\", \"encrypted_password\", \"id\", \"instance_id\", \"invited_at\", \"is_anonymous\", \"is_sso_user\", \"last_sign_in_at\", \"phone\", \"phone_change\", \"phone_change_sent_at\", \"phone_change_token\", \"phone_confirmed_at\", \"raw_app_meta_data\", \"raw_user_meta_data\", \"reauthentication_sent_at\", \"reauthentication_token\", \"recovery_sent_at\", \"recovery_token\", \"role\", \"updated_at\") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)",
          "query_id": -5643122554370342000,
          "query_pos": null,
          "session_id": "697d7f8e.75571",
          "session_line_num": 4,
          "session_start_time": "2026-01-31 04:05:34 UTC",
          "sql_state_code": "42703",
          "timestamp": "2026-01-31 04:05:46.020 UTC",
          "transaction_id": 1626,
          "user_name": "supabase_auth_admin",
          "virtual_transaction_id": "22/2806"
        }
      ],
      "parsed_from": null,
      "project": null,
      "source_type": null
    }
  ],
  "timestamp": 1769832346020000
}

{
  "event_message": "current transaction is aborted, commands ignored until end of transaction block",
  "id": "9d28fb36-589e-4712-9a54-68e7073bac94",
  "metadata": [
    {
      "file": null,
      "host": "db-kthplniuiqiszuzhpxmy",
      "metadata": [],
      "parsed": [
        {
          "application_name": null,
          "backend_type": "client backend",
          "command_tag": "DEALLOCATE",
          "connection_from": "127.0.0.1:36753",
          "context": null,
          "database_name": "postgres",
          "detail": null,
          "error_severity": "ERROR",
          "hint": null,
          "internal_query": null,
          "internal_query_pos": null,
          "leader_pid": null,
          "location": null,
          "process_id": 480625,
          "query": "deallocate \"pgx_1\"",
          "query_id": 0,
          "query_pos": null,
          "session_id": "697d7f8e.75571",
          "session_line_num": 5,
          "session_start_time": "2026-01-31 04:05:34 UTC",
          "sql_state_code": "25P02",
          "timestamp": "2026-01-31 04:05:46.020 UTC",
          "transaction_id": 1626,
          "user_name": "supabase_auth_admin",
          "virtual_transaction_id": "22/0"
        }
      ],
      "parsed_from": null,
      "project": null,
      "source_type": null
    }
  ],
  "timestamp": 1769832346020000
}

---