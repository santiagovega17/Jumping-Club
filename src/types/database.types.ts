export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      franquicias: {
        Row: {
          id: string;
          nombre: string;
          direccion: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          nombre: string;
          direccion?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          nombre?: string;
          direccion?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      perfiles: {
        Row: {
          id: string;
          rol: "admin_global" | "admin_franquicia" | "socio";
          franquicia_id: string | null;
          nombre: string;
          email: string;
          created_at: string | null;
        };
        Insert: {
          id: string;
          rol: "admin_global" | "admin_franquicia" | "socio";
          franquicia_id?: string | null;
          nombre: string;
          email: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          rol?: "admin_global" | "admin_franquicia" | "socio";
          franquicia_id?: string | null;
          nombre?: string;
          email?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "perfiles_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "perfiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      instructores: {
        Row: {
          id: string;
          franquicia_id: string | null;
          nombre: string;
          estado: string | null;
          especialidad: string | null;
        };
        Insert: {
          id?: string;
          franquicia_id?: string | null;
          nombre: string;
          estado?: string | null;
          especialidad?: string | null;
        };
        Update: {
          id?: string;
          franquicia_id?: string | null;
          nombre?: string;
          estado?: string | null;
          especialidad?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "instructores_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
        ];
      };
      formas_pago: {
        Row: {
          id: string;
          franquicia_id: string;
          nombre: string;
          orden: number;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          franquicia_id: string;
          nombre: string;
          orden?: number;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          franquicia_id?: string;
          nombre?: string;
          orden?: number;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "formas_pago_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
        ];
      };
      conceptos_caja: {
        Row: {
          id: string;
          franquicia_id: string;
          tipo: "ingreso" | "egreso";
          concepto: string;
          descripcion: string;
          orden: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          franquicia_id: string;
          tipo: "ingreso" | "egreso";
          concepto: string;
          descripcion: string;
          orden?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          franquicia_id?: string;
          tipo?: "ingreso" | "egreso";
          concepto?: string;
          descripcion?: string;
          orden?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conceptos_caja_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
        ];
      };
      plantillas_clases: {
        Row: {
          id: string;
          franquicia_id: string;
          nombre: string;
          instructor_id: string;
          horario: string;
          dia_semana: "lun" | "mar" | "mie" | "jue" | "vie" | "sab";
          valid_from: string | null;
          valid_to: string | null;
          cupo_maximo: number | null;
          orden: number;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          franquicia_id: string;
          nombre: string;
          instructor_id: string;
          horario: string;
          dia_semana: "lun" | "mar" | "mie" | "jue" | "vie" | "sab";
          valid_from?: string | null;
          valid_to?: string | null;
          cupo_maximo?: number | null;
          orden?: number;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          franquicia_id?: string;
          nombre?: string;
          instructor_id?: string;
          horario?: string;
          dia_semana?: "lun" | "mar" | "mie" | "jue" | "vie" | "sab";
          valid_from?: string | null;
          valid_to?: string | null;
          cupo_maximo?: number | null;
          orden?: number;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plantillas_clases_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantillas_clases_instructor_id_fkey";
            columns: ["instructor_id"];
            isOneToOne: false;
            referencedRelation: "instructores";
            referencedColumns: ["id"];
          },
        ];
      };
      planes: {
        Row: {
          id: string;
          franquicia_id: string | null;
          nombre: string;
          precio: number;
          version: string | null;
          estado: string | null;
        };
        Insert: {
          id?: string;
          franquicia_id?: string | null;
          nombre: string;
          precio: number;
          version?: string | null;
          estado?: string | null;
        };
        Update: {
          id?: string;
          franquicia_id?: string | null;
          nombre?: string;
          precio?: number;
          version?: string | null;
          estado?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "planes_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
        ];
      };
      socios: {
        Row: {
          id: string;
          perfil_id: string | null;
          franquicia_id: string | null;
          plan_id: string | null;
          instructor_id: string | null;
          dni: string | null;
          domicilio: string | null;
          provincia: string | null;
          telefono: string | null;
          mes_ultimo_aumento: string;
          estado: string | null;
        };
        Insert: {
          id?: string;
          perfil_id?: string | null;
          franquicia_id?: string | null;
          plan_id?: string | null;
          instructor_id?: string | null;
          dni?: string | null;
          domicilio?: string | null;
          provincia?: string | null;
          telefono?: string | null;
          mes_ultimo_aumento?: string;
          estado?: string | null;
        };
        Update: {
          id?: string;
          perfil_id?: string | null;
          franquicia_id?: string | null;
          plan_id?: string | null;
          instructor_id?: string | null;
          dni?: string | null;
          domicilio?: string | null;
          provincia?: string | null;
          telefono?: string | null;
          mes_ultimo_aumento?: string;
          estado?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "socios_perfil_id_fkey";
            columns: ["perfil_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "socios_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "socios_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "socios_instructor_id_fkey";
            columns: ["instructor_id"];
            isOneToOne: false;
            referencedRelation: "instructores";
            referencedColumns: ["id"];
          },
        ];
      };
      movimientos_caja: {
        Row: {
          id: string;
          franquicia_id: string | null;
          concepto_id: string | null;
          forma_pago_id: string | null;
          socio_id: string | null;
          tipo: "ingreso" | "egreso";
          monto: number;
          fecha: string;
          observaciones: string | null;
          estado: "pagado" | "pendiente" | "anulado" | null;
          fecha_vencimiento: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          franquicia_id?: string | null;
          concepto_id?: string | null;
          forma_pago_id?: string | null;
          socio_id?: string | null;
          tipo: "ingreso" | "egreso";
          monto: number;
          fecha: string;
          observaciones?: string | null;
          estado?: "pagado" | "pendiente" | "anulado" | null;
          fecha_vencimiento?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          franquicia_id?: string | null;
          concepto_id?: string | null;
          forma_pago_id?: string | null;
          socio_id?: string | null;
          tipo?: "ingreso" | "egreso";
          monto?: number;
          fecha?: string;
          observaciones?: string | null;
          estado?: "pagado" | "pendiente" | "anulado" | null;
          fecha_vencimiento?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_caja_concepto_id_fkey";
            columns: ["concepto_id"];
            isOneToOne: false;
            referencedRelation: "conceptos_caja";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_caja_forma_pago_id_fkey";
            columns: ["forma_pago_id"];
            isOneToOne: false;
            referencedRelation: "formas_pago";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_caja_socio_id_fkey";
            columns: ["socio_id"];
            isOneToOne: false;
            referencedRelation: "socios";
            referencedColumns: ["id"];
          },
        ];
      };
      inscripciones: {
        Row: {
          id: string;
          clase_id: string;
          socio_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          clase_id: string;
          socio_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          clase_id?: string;
          socio_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inscripciones_clase_id_fkey";
            columns: ["clase_id"];
            isOneToOne: false;
            referencedRelation: "clases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inscripciones_socio_id_fkey";
            columns: ["socio_id"];
            isOneToOne: false;
            referencedRelation: "socios";
            referencedColumns: ["id"];
          },
        ];
      };
      clases_historial: {
        Row: {
          id: string;
          clase_id: string;
          franquicia_id: string;
          nombre_anterior: string;
          instructor_id_anterior: string | null;
          fecha_hora_anterior: string;
          nombre_nuevo: string;
          instructor_id_nuevo: string | null;
          fecha_hora_nuevo: string;
          editado_en: string | null;
        };
        Insert: {
          id?: string;
          clase_id: string;
          franquicia_id: string;
          nombre_anterior: string;
          instructor_id_anterior?: string | null;
          fecha_hora_anterior: string;
          nombre_nuevo: string;
          instructor_id_nuevo?: string | null;
          fecha_hora_nuevo: string;
          editado_en?: string | null;
        };
        Update: {
          id?: string;
          clase_id?: string;
          franquicia_id?: string;
          nombre_anterior?: string;
          instructor_id_anterior?: string | null;
          fecha_hora_anterior?: string;
          nombre_nuevo?: string;
          instructor_id_nuevo?: string | null;
          fecha_hora_nuevo?: string;
          editado_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clases_historial_clase_id_fkey";
            columns: ["clase_id"];
            isOneToOne: false;
            referencedRelation: "clases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clases_historial_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
        ];
      };
      clases: {
        Row: {
          id: string;
          franquicia_id: string | null;
          instructor_id: string | null;
          nombre: string;
          fecha_hora: string;
          cupo_maximo: number;
          reservas_actuales: number | null;
          estado: string | null;
        };
        Insert: {
          id?: string;
          franquicia_id?: string | null;
          instructor_id?: string | null;
          nombre: string;
          fecha_hora: string;
          cupo_maximo?: number;
          reservas_actuales?: number | null;
          estado?: string | null;
        };
        Update: {
          id?: string;
          franquicia_id?: string | null;
          instructor_id?: string | null;
          nombre?: string;
          fecha_hora?: string;
          cupo_maximo?: number;
          reservas_actuales?: number | null;
          estado?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clases_franquicia_id_fkey";
            columns: ["franquicia_id"];
            isOneToOne: false;
            referencedRelation: "franquicias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clases_instructor_id_fkey";
            columns: ["instructor_id"];
            isOneToOne: false;
            referencedRelation: "instructores";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];
export type Socio = Database["public"]["Tables"]["socios"]["Row"];
export type FormaPago = Database["public"]["Tables"]["formas_pago"]["Row"];
export type ConceptoCaja = Database["public"]["Tables"]["conceptos_caja"]["Row"];
export type PlantillaClase = Database["public"]["Tables"]["plantillas_clases"]["Row"];
export type MovimientoCaja = Database["public"]["Tables"]["movimientos_caja"]["Row"];
export type Inscripcion = Database["public"]["Tables"]["inscripciones"]["Row"];
export type ClaseHistorial = Database["public"]["Tables"]["clases_historial"]["Row"];
