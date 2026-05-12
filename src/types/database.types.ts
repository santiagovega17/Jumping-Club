export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      clases: {
        Row: {
          cupo_maximo: number
          estado: string | null
          fecha_hora: string
          franquicia_id: string | null
          id: string
          instructor_id: string | null
          nombre: string
          reservas_actuales: number | null
        }
        Insert: {
          cupo_maximo?: number
          estado?: string | null
          fecha_hora: string
          franquicia_id?: string | null
          id?: string
          instructor_id?: string | null
          nombre: string
          reservas_actuales?: number | null
        }
        Update: {
          cupo_maximo?: number
          estado?: string | null
          fecha_hora?: string
          franquicia_id?: string | null
          id?: string
          instructor_id?: string | null
          nombre?: string
          reservas_actuales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clases_franquicia_id_fkey"
            columns: ["franquicia_id"]
            isOneToOne: false
            referencedRelation: "franquicias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clases_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructores"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos_caja: {
        Row: {
          concepto: string
          created_at: string
          descripcion: string
          franquicia_id: string
          id: string
          orden: number
          tipo: string
        }
        Insert: {
          concepto: string
          created_at?: string
          descripcion: string
          franquicia_id: string
          id?: string
          orden?: number
          tipo: string
        }
        Update: {
          concepto?: string
          created_at?: string
          descripcion?: string
          franquicia_id?: string
          id?: string
          orden?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_caja_franquicia_id_fkey"
            columns: ["franquicia_id"]
            isOneToOne: false
            referencedRelation: "franquicias"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pago: {
        Row: {
          activo: boolean
          created_at: string
          franquicia_id: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          franquicia_id: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          franquicia_id?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "formas_pago_franquicia_id_fkey"
            columns: ["franquicia_id"]
            isOneToOne: false
            referencedRelation: "franquicias"
            referencedColumns: ["id"]
          },
        ]
      }
      franquicias: {
        Row: {
          created_at: string | null
          direccion: string | null
          id: string
          minutos_limite_baja_inscripcion: number
          nombre: string
        }
        Insert: {
          created_at?: string | null
          direccion?: string | null
          id?: string
          minutos_limite_baja_inscripcion?: number
          nombre: string
        }
        Update: {
          created_at?: string | null
          direccion?: string | null
          id?: string
          minutos_limite_baja_inscripcion?: number
          nombre?: string
        }
        Relationships: []
      }
      inscripciones: {
        Row: {
          clase_id: string
          created_at: string
          id: string
          socio_id: string
        }
        Insert: {
          clase_id: string
          created_at?: string
          id?: string
          socio_id: string
        }
        Update: {
          clase_id?: string
          created_at?: string
          id?: string
          socio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscripciones_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "clases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripciones_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      instructores: {
        Row: {
          especialidad: string | null
          estado: string | null
          franquicia_id: string | null
          id: string
          nombre: string
        }
        Insert: {
          especialidad?: string | null
          estado?: string | null
          franquicia_id?: string | null
          id?: string
          nombre: string
        }
        Update: {
          especialidad?: string | null
          estado?: string | null
          franquicia_id?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructores_franquicia_id_fkey"
            columns: ["franquicia_id"]
            isOneToOne: false
            referencedRelation: "franquicias"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_caja: {
        Row: {
          concepto_id: string
          estado: string | null
          fecha: string
          fecha_vencimiento: string | null
          forma_pago_id: string
          franquicia_id: string
          id: string
          monto: number
          observaciones: string | null
          socio_id: string | null
          tipo: string
        }
        Insert: {
          concepto_id: string
          estado?: string | null
          fecha?: string
          fecha_vencimiento?: string | null
          forma_pago_id: string
          franquicia_id: string
          id?: string
          monto: number
          observaciones?: string | null
          socio_id?: string | null
          tipo: string
        }
        Update: {
          concepto_id?: string
          estado?: string | null
          fecha?: string
          fecha_vencimiento?: string | null
          forma_pago_id?: string
          franquicia_id?: string
          id?: string
          monto?: number
          observaciones?: string | null
          socio_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos_caja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_caja_forma_pago_id_fkey"
            columns: ["forma_pago_id"]
            isOneToOne: false
            referencedRelation: "formas_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_caja_franquicia_id_fkey"
            columns: ["franquicia_id"]
            isOneToOne: false
            referencedRelation: "franquicias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_caja_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          created_at: string | null
          email: string
          franquicia_id: string | null
          id: string
          nombre: string
          rol: string
        }
        Insert: {
          created_at?: string | null
          email: string
          franquicia_id?: string | null
          id: string
          nombre: string
          rol: string
        }
        Update: {
          created_at?: string | null
          email?: string
          franquicia_id?: string | null
          id?: string
          nombre?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_franquicia_id_fkey"
            columns: ["franquicia_id"]
            isOneToOne: false
            referencedRelation: "franquicias"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          clases_por_semana: number
          estado: string | null
          franquicia_id: string | null
          global_plan_id: string | null
          id: string
          nombre: string
          precio: number
          version: string | null
        }
        Insert: {
          clases_por_semana?: number
          estado?: string | null
          franquicia_id?: string | null
          global_plan_id?: string | null
          id?: string
          nombre: string
          precio: number
          version?: string | null
        }
        Update: {
          clases_por_semana?: number
          estado?: string | null
          franquicia_id?: string | null
          global_plan_id?: string | null
          id?: string
          nombre?: string
          precio?: number
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planes_franquicia_id_fkey"
            columns: ["franquicia_id"]
            isOneToOne: false
            referencedRelation: "franquicias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_global_plan_id_fkey"
            columns: ["global_plan_id"]
            isOneToOne: false
            referencedRelation: "universal_jumps_global_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_clases: {
        Row: {
          activo: boolean
          created_at: string
          cupo_maximo: number | null
          dia_semana: string
          franquicia_id: string
          horario: string
          id: string
          instructor_id: string
          nombre: string
          orden: number
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          cupo_maximo?: number | null
          dia_semana: string
          franquicia_id: string
          horario: string
          id?: string
          instructor_id: string
          nombre: string
          orden?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          cupo_maximo?: number | null
          dia_semana?: string
          franquicia_id?: string
          horario?: string
          id?: string
          instructor_id?: string
          nombre?: string
          orden?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_clases_franquicia_id_fkey"
            columns: ["franquicia_id"]
            isOneToOne: false
            referencedRelation: "franquicias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantillas_clases_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructores"
            referencedColumns: ["id"]
          },
        ]
      }
      socios: {
        Row: {
          dni: string | null
          domicilio: string | null
          estado: string | null
          franquicia_id: string | null
          id: string
          instructor_id: string | null
          mes_ultimo_aumento: string
          perfil_id: string | null
          plan_id: string | null
          provincia: string | null
          telefono: string | null
        }
        Insert: {
          dni?: string | null
          domicilio?: string | null
          estado?: string | null
          franquicia_id?: string | null
          id?: string
          instructor_id?: string | null
          mes_ultimo_aumento?: string
          perfil_id?: string | null
          plan_id?: string | null
          provincia?: string | null
          telefono?: string | null
        }
        Update: {
          dni?: string | null
          domicilio?: string | null
          estado?: string | null
          franquicia_id?: string | null
          id?: string
          instructor_id?: string | null
          mes_ultimo_aumento?: string
          perfil_id?: string | null
          plan_id?: string | null
          provincia?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "socios_franquicia_id_fkey"
            columns: ["franquicia_id"]
            isOneToOne: false
            referencedRelation: "franquicias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "socios_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "socios_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "socios_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      universal_jumps_global_plans: {
        Row: {
          activo: boolean
          clases_por_semana: number
          created_at: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clases_por_semana: number
          created_at?: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clases_por_semana?: number
          created_at?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      universal_jumps_global_templates: {
        Row: {
          conceptos_ingreso_default: string[]
          formas_pago_default: string[]
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          conceptos_ingreso_default?: string[]
          formas_pago_default?: string[]
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          conceptos_ingreso_default?: string[]
          formas_pago_default?: string[]
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "universal_jumps_global_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
