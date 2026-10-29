
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ambitos": {
                  Row: {
                    "color_hex": string | null,"color_token": string,"created_at": string,"household_id": string,"icon_key": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color_hex"?: string | null,"color_token"?: string,"created_at"?: string,"household_id": string,"icon_key"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "color_hex"?: string | null,"color_token"?: string,"created_at"?: string,"household_id"?: string,"icon_key"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ambitos_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"after_state": Json | null,"before_state": Json | null,"created_at": string,"entity": string,"entity_id": string | null,"household_id": string,"id": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"after_state"?: Json | null,"before_state"?: Json | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"household_id": string,"id"?: never,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"after_state"?: Json | null,"before_state"?: Json | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"household_id"?: string,"id"?: never,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"budget_periods": {
                  Row: {
                    "closed_at": string | null,"created_at": string,"end_date": string,"household_id": string,"id": string,"start_date": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"created_at"?: string,"end_date": string,"household_id": string,"id"?: string,"start_date": string,"status"?: string
                  }
                  Update: {
                    "closed_at"?: string | null,"created_at"?: string,"end_date"?: string,"household_id"?: string,"id"?: string,"start_date"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budget_periods_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"categorias": {
                  Row: {
                    "ambito_id": string,"color_hex": string | null,"color_mode": string,"color_token": string,"created_at": string,"household_id": string,"icon_key": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ambito_id": string,"color_hex"?: string | null,"color_mode"?: string,"color_token"?: string,"created_at"?: string,"household_id": string,"icon_key"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "ambito_id"?: string,"color_hex"?: string | null,"color_mode"?: string,"color_token"?: string,"created_at"?: string,"household_id"?: string,"icon_key"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categorias_ambito_id_household_id_fkey"
      columns: ["ambito_id","household_id"]
isOneToOne: false
      referencedRelation: "ambitos"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "categorias_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_fund_allocations": {
                  Row: {
                    "allocation_kind": string,"amount": number,"created_at": string,"expense_id": string,"fund_id": string,"household_id": string,"id": string,"period_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allocation_kind": string,"amount": number,"created_at"?: string,"expense_id": string,"fund_id": string,"household_id": string,"id"?: string,"period_id": string
                  }
                  Update: {
                    "allocation_kind"?: string,"amount"?: number,"created_at"?: string,"expense_id"?: string,"fund_id"?: string,"household_id"?: string,"id"?: string,"period_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_fund_allocations_expense_id_household_id_fkey"
      columns: ["expense_id","household_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "expense_fund_allocations_fund_id_household_id_fkey"
      columns: ["fund_id","household_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "expense_fund_allocations_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_fund_allocations_period_id_household_id_fkey"
      columns: ["period_id","household_id"]
isOneToOne: false
      referencedRelation: "budget_periods"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"expense_templates": {
                  Row: {
                    "ambito_id": string,"categoria_id": string,"created_at": string,"day_of_month": number | null,"default_amount": number | null,"default_fund_id": string | null,"description": string,"expense_type": string,"household_id": string,"id": string,"is_active": boolean,"is_amount_variable": boolean,"name": string,"payment_method_id": string | null,"recurrence": string,"sort_order": number,"subcategoria_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ambito_id": string,"categoria_id": string,"created_at"?: string,"day_of_month"?: number | null,"default_amount"?: number | null,"default_fund_id"?: string | null,"description": string,"expense_type"?: string,"household_id": string,"id"?: string,"is_active"?: boolean,"is_amount_variable"?: boolean,"name": string,"payment_method_id"?: string | null,"recurrence"?: string,"sort_order"?: number,"subcategoria_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ambito_id"?: string,"categoria_id"?: string,"created_at"?: string,"day_of_month"?: number | null,"default_amount"?: number | null,"default_fund_id"?: string | null,"description"?: string,"expense_type"?: string,"household_id"?: string,"id"?: string,"is_active"?: boolean,"is_amount_variable"?: boolean,"name"?: string,"payment_method_id"?: string | null,"recurrence"?: string,"sort_order"?: number,"subcategoria_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_templates_ambito_id_household_id_fkey"
      columns: ["ambito_id","household_id"]
isOneToOne: false
      referencedRelation: "ambitos"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "expense_templates_categoria_id_ambito_id_fkey"
      columns: ["categoria_id","ambito_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["id","ambito_id"]
    },{
      foreignKeyName: "expense_templates_default_fund_id_household_id_fkey"
      columns: ["default_fund_id","household_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "expense_templates_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_templates_payment_method_id_household_id_fkey"
      columns: ["payment_method_id","household_id"]
isOneToOne: false
      referencedRelation: "medios_pago"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "expense_templates_subcategoria_id_categoria_id_fkey"
      columns: ["subcategoria_id","categoria_id"]
isOneToOne: false
      referencedRelation: "subcategorias"
      referencedColumns: ["id","categoria_id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "ambito_id": string,"amount": number,"annulled_at": string | null,"annulled_by": string | null,"categoria_id": string,"created_at": string,"created_by": string | null,"currency": string,"description": string,"expense_date": string,"expense_type": string,"household_id": string,"id": string,"is_recurring": boolean,"notes": string | null,"payment_method_id": string,"receipt_path": string | null,"status": string,"subcategoria_id": string | null,"template_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ambito_id": string,"amount": number,"annulled_at"?: string | null,"annulled_by"?: string | null,"categoria_id": string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description": string,"expense_date": string,"expense_type"?: string,"household_id": string,"id"?: string,"is_recurring"?: boolean,"notes"?: string | null,"payment_method_id": string,"receipt_path"?: string | null,"status"?: string,"subcategoria_id"?: string | null,"template_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ambito_id"?: string,"amount"?: number,"annulled_at"?: string | null,"annulled_by"?: string | null,"categoria_id"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string,"expense_date"?: string,"expense_type"?: string,"household_id"?: string,"id"?: string,"is_recurring"?: boolean,"notes"?: string | null,"payment_method_id"?: string,"receipt_path"?: string | null,"status"?: string,"subcategoria_id"?: string | null,"template_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_ambito_id_household_id_fkey"
      columns: ["ambito_id","household_id"]
isOneToOne: false
      referencedRelation: "ambitos"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "expenses_categoria_id_ambito_id_fkey"
      columns: ["categoria_id","ambito_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["id","ambito_id"]
    },{
      foreignKeyName: "expenses_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_payment_method_id_household_id_fkey"
      columns: ["payment_method_id","household_id"]
isOneToOne: false
      referencedRelation: "medios_pago"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "expenses_subcategoria_id_categoria_id_fkey"
      columns: ["subcategoria_id","categoria_id"]
isOneToOne: false
      referencedRelation: "subcategorias"
      referencedColumns: ["id","categoria_id"]
    },{
      foreignKeyName: "expenses_template_id_household_id_fkey"
      columns: ["template_id","household_id"]
isOneToOne: false
      referencedRelation: "expense_templates"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"fund_payment_rules": {
                  Row: {
                    "created_at": string,"effect": string,"fund_id": string,"household_id": string,"id": string,"payment_method_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"effect": string,"fund_id": string,"household_id": string,"id"?: string,"payment_method_id": string
                  }
                  Update: {
                    "created_at"?: string,"effect"?: string,"fund_id"?: string,"household_id"?: string,"id"?: string,"payment_method_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fund_payment_rules_fund_id_household_id_fkey"
      columns: ["fund_id","household_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "fund_payment_rules_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fund_payment_rules_payment_method_id_household_id_fkey"
      columns: ["payment_method_id","household_id"]
isOneToOne: false
      referencedRelation: "medios_pago"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"fund_period_budgets": {
                  Row: {
                    "assigned_amount": number,"created_at": string,"fund_id": string,"household_id": string,"id": string,"period_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_amount"?: number,"created_at"?: string,"fund_id": string,"household_id": string,"id"?: string,"period_id": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_amount"?: number,"created_at"?: string,"fund_id"?: string,"household_id"?: string,"id"?: string,"period_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fund_period_budgets_fund_id_household_id_fkey"
      columns: ["fund_id","household_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "fund_period_budgets_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fund_period_budgets_period_id_household_id_fkey"
      columns: ["period_id","household_id"]
isOneToOne: false
      referencedRelation: "budget_periods"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"fund_scope_rules": {
                  Row: {
                    "ambito_id": string | null,"categoria_id": string | null,"created_at": string,"effect": string,"fund_id": string,"household_id": string,"id": string,"subcategoria_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ambito_id"?: string | null,"categoria_id"?: string | null,"created_at"?: string,"effect": string,"fund_id": string,"household_id": string,"id"?: string,"subcategoria_id"?: string | null
                  }
                  Update: {
                    "ambito_id"?: string | null,"categoria_id"?: string | null,"created_at"?: string,"effect"?: string,"fund_id"?: string,"household_id"?: string,"id"?: string,"subcategoria_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fund_scope_rules_ambito_id_household_id_fkey"
      columns: ["ambito_id","household_id"]
isOneToOne: false
      referencedRelation: "ambitos"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "fund_scope_rules_categoria_id_household_id_fkey"
      columns: ["categoria_id","household_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "fund_scope_rules_fund_id_household_id_fkey"
      columns: ["fund_id","household_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "fund_scope_rules_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fund_scope_rules_subcategoria_id_household_id_fkey"
      columns: ["subcategoria_id","household_id"]
isOneToOne: false
      referencedRelation: "subcategorias"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"funds": {
                  Row: {
                    "color_token": string | null,"created_at": string,"default_amount": number,"description": string | null,"household_id": string,"icon_key": string | null,"id": string,"is_active": boolean,"is_general": boolean,"name": string,"priority": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color_token"?: string | null,"created_at"?: string,"default_amount"?: number,"description"?: string | null,"household_id": string,"icon_key"?: string | null,"id"?: string,"is_active"?: boolean,"is_general"?: boolean,"name": string,"priority"?: number,"updated_at"?: string
                  }
                  Update: {
                    "color_token"?: string | null,"created_at"?: string,"default_amount"?: number,"description"?: string | null,"household_id"?: string,"icon_key"?: string | null,"id"?: string,"is_active"?: boolean,"is_general"?: boolean,"name"?: string,"priority"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "funds_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "created_at": string,"household_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"is_demo": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"is_demo"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"is_demo"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"idempotency_requests": {
                  Row: {
                    "created_at": string,"household_id": string,"key": string,"operation": string,"response": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"key": string,"operation": string,"response": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"key"?: string,"operation"?: string,"response"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "idempotency_requests_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"medios_pago": {
                  Row: {
                    "color_hex": string | null,"color_token": string,"created_at": string,"household_id": string,"icon_key": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color_hex"?: string | null,"color_token"?: string,"created_at"?: string,"household_id": string,"icon_key"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "color_hex"?: string | null,"color_token"?: string,"created_at"?: string,"household_id"?: string,"icon_key"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "medios_pago_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"period_fund_snapshots": {
                  Row: {
                    "assigned_amount": number,"consumed_amount": number,"created_at": string,"fund_id": string,"fund_name": string,"household_id": string,"id": string,"is_general": boolean,"period_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_amount": number,"consumed_amount": number,"created_at"?: string,"fund_id": string,"fund_name": string,"household_id": string,"id"?: string,"is_general": boolean,"period_id": string
                  }
                  Update: {
                    "assigned_amount"?: number,"consumed_amount"?: number,"created_at"?: string,"fund_id"?: string,"fund_name"?: string,"household_id"?: string,"id"?: string,"is_general"?: boolean,"period_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "period_fund_snapshots_fund_id_fkey"
      columns: ["fund_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "period_fund_snapshots_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "period_fund_snapshots_period_id_household_id_fkey"
      columns: ["period_id","household_id"]
isOneToOne: false
      referencedRelation: "budget_periods"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"date_format": string,"display_currency": string,"display_name": string | null,"household_id": string | null,"theme": string,"timezone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date_format"?: string,"display_currency"?: string,"display_name"?: string | null,"household_id"?: string | null,"theme"?: string,"timezone"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"date_format"?: string,"display_currency"?: string,"display_name"?: string | null,"household_id"?: string | null,"theme"?: string,"timezone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"storage_cleanup_tasks": {
                  Row: {
                    "attempts": number,"bucket": string,"created_at": string,"household_id": string,"id": string,"last_error": string | null,"not_before": string,"path": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"bucket"?: string,"created_at"?: string,"household_id": string,"id"?: string,"last_error"?: string | null,"not_before"?: string,"path": string,"reason": string
                  }
                  Update: {
                    "attempts"?: number,"bucket"?: string,"created_at"?: string,"household_id"?: string,"id"?: string,"last_error"?: string | null,"not_before"?: string,"path"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "storage_cleanup_tasks_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"subcategorias": {
                  Row: {
                    "categoria_id": string,"color_hex": string | null,"color_mode": string,"created_at": string,"household_id": string,"icon_key": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria_id": string,"color_hex"?: string | null,"color_mode"?: string,"created_at"?: string,"household_id": string,"icon_key"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "categoria_id"?: string,"color_hex"?: string | null,"color_mode"?: string,"created_at"?: string,"household_id"?: string,"icon_key"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subcategorias_categoria_id_household_id_fkey"
      columns: ["categoria_id","household_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "subcategorias_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"template_batch_items": {
                  Row: {
                    "amount": number | null,"batch_id": string,"created_at": string,"expense_id": string | null,"household_id": string,"id": string,"outcome": string,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number | null,"batch_id": string,"created_at"?: string,"expense_id"?: string | null,"household_id": string,"id"?: string,"outcome": string,"template_id": string
                  }
                  Update: {
                    "amount"?: number | null,"batch_id"?: string,"created_at"?: string,"expense_id"?: string | null,"household_id"?: string,"id"?: string,"outcome"?: string,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_batch_items_batch_id_household_id_fkey"
      columns: ["batch_id","household_id"]
isOneToOne: false
      referencedRelation: "template_batches"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "template_batch_items_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_batch_items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_batch_items_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "expense_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"template_batches": {
                  Row: {
                    "created_at": string,"executed_by": string | null,"expense_count": number,"household_id": string,"id": string,"idempotency_key": string,"period_id": string,"status": string,"total_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"executed_by"?: string | null,"expense_count"?: number,"household_id": string,"id"?: string,"idempotency_key": string,"period_id": string,"status"?: string,"total_amount"?: number
                  }
                  Update: {
                    "created_at"?: string,"executed_by"?: string | null,"expense_count"?: number,"household_id"?: string,"id"?: string,"idempotency_key"?: string,"period_id"?: string,"status"?: string,"total_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_batches_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_batches_period_id_household_id_fkey"
      columns: ["period_id","household_id"]
isOneToOne: false
      referencedRelation: "budget_periods"
      referencedColumns: ["id","household_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "alloc_signature":
{ Args: { "hid": string }; Returns: Json
                           },
"annul_expenses":
{ Args: { "p_ids": (string)[] }; Returns: Json
                           },
"apply_template_batch":
{ Args: { "p_items": Json,"p_key": string,"p_period_date": string }; Returns: Json
                           },
"bootstrap_catalog":
{ Args: { "hid": string }; Returns: undefined
                           },
"close_period":
{ Args: { "p_period": string }; Returns: undefined
                           },
"completar_limpieza":
{ Args: { "p_ids": (string)[] }; Returns: number
                           },
"count_changed":
{ Args: { "p_after": Json,"p_before": Json }; Returns: number
                           },
"create_expense":
{ Args: { "p": Json,"p_key": string }; Returns: Json
                           },
"current_household_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"dashboard_analisis":
{ Args: { "p_desde": string,"p_hasta": string }; Returns: Json
                           },
"dashboard_panel":
{ Args: { "p_ambito"?: string,"p_categoria"?: string[],"p_desde": string,"p_dia"?: string,"p_hasta": string,"p_medio"?: string,"p_prev_desde": string,"p_prev_hasta": string,"p_subcategoria"?: string[],"p_tipo"?: string }; Returns: Json
                           },
"delete_fund":
{ Args: { "p_destino"?: string,"p_dry_run"?: boolean,"p_fund": string }; Returns: Json
                           },
"ensure_period":
{ Args: { "hid": string,"p_date": string }; Returns: string
                           },
"ensure_period_rpc":
{ Args: { "p_date": string }; Returns: {
              "closed_at": string | null,
"created_at": string,
"end_date": string,
"household_id": string,
"id": string,
"start_date": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "budget_periods"
        isOneToOne: true
        isSetofReturn: false
      } },
"expense_report":
{ Args: { "p_expense": string }; Returns: Json
                           },
"fallo_limpieza":
{ Args: { "p_error": string,"p_ids": (string)[] }; Returns: undefined
                           },
"fund_admits":
{ Args: { "p_ambito": string,"p_cat": string,"p_fund": string,"p_method": string,"p_sub": string }; Returns: boolean
                           },
"fund_admits_method":
{ Args: { "p_fund": string,"p_method": string }; Returns: boolean
                           },
"fund_admits_scope":
{ Args: { "p_ambito": string,"p_cat": string,"p_fund": string,"p_sub": string }; Returns: boolean
                           },
"fund_period_detail":
{ Args: { "hid": string }; Returns: Json
                           },
"is_household_member":
{ Args: { "hid": string }; Returns: boolean
                           },
"is_household_owner":
{ Args: { "hid": string }; Returns: boolean
                           },
"is_valid_color":
{ Args: { "k": string }; Returns: boolean
                           },
"is_valid_icon":
{ Args: { "k": string }; Returns: boolean
                           },
"listar_limpieza":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"path": string
            }[]
                           },
"open_consumption":
{ Args: { "hid": string }; Returns: Json
                           },
"preview_expense":
{ Args: { "p": Json }; Returns: Json
                           },
"preview_fund_change":
{ Args: { "p_args": Json,"p_kind": string }; Returns: Json
                           },
"recalc_period":
{ Args: { "p_period": string }; Returns: undefined
                           },
"registrar_limpieza":
{ Args: { "p_demora_min"?: number,"p_paths": (string)[],"p_reason": string }; Returns: number
                           },
"reorder_catalog":
{ Args: { "p_ids": (string)[],"p_kind": string }; Returns: undefined
                           },
"reorder_funds":
{ Args: { "p_dry_run"?: boolean,"p_ids": (string)[] }; Returns: Json
                           },
"restore_expenses":
{ Args: { "p_ids": (string)[] }; Returns: Json
                           },
"save_fund":
{ Args: { "p": Json,"p_dry_run"?: boolean }; Returns: Json
                           },
"set_expenses_status":
{ Args: { "p_annul": boolean,"p_ids": (string)[] }; Returns: Json
                           },
"set_fund_period_budget":
{ Args: { "p_amount": number,"p_dry_run"?: boolean,"p_fund": string,"p_period": string }; Returns: Json
                           },
"storage_household":
{ Args: { "p_name": string }; Returns: string
                           },
"update_expense":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
