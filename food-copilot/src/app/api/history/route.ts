import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET: Fetch user's scan history
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')

  const { data, error } = await supabase
    .from('scan_history')
    .select('*')
    .eq('user_id', user.id)
    .order('scanned_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }

  return NextResponse.json({ history: data })
}

// POST: Add to scan history
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { barcode, product_name, brand, nova_group, nutri_score, product_id } = body

  if (!barcode) {
    return NextResponse.json({ error: 'Barcode is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scan_history')
    .insert({
      user_id: user.id,
      barcode,
      product_name,
      brand,
      nova_group,
      nutri_score,
      product_id
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save to history' }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}

// DELETE: Remove from history
export async function DELETE(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const historyId = searchParams.get('id')
  const clearAll = searchParams.get('clearAll') === 'true'

  if (clearAll) {
    // Clear all non-favorite items
    const { error } = await supabase
      .from('scan_history')
      .delete()
      .eq('user_id', user.id)
      .eq('is_favorite', false)

    if (error) {
      return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (!historyId) {
    return NextResponse.json({ error: 'History ID is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('scan_history')
    .delete()
    .eq('id', historyId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// PATCH: Update favorite status
export async function PATCH(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, is_favorite } = body

  if (!id || typeof is_favorite !== 'boolean') {
    return NextResponse.json({ error: 'ID and is_favorite are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scan_history')
    .update({ is_favorite })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}
